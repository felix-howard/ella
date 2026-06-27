/**
 * Portal sent-quote checkout: token-protected public view + on-demand Stripe
 * Checkout Session creation for a PaymentQuote that was sent to a Client/Lead.
 *
 * Distinct from the deposit flow (deposit-checkout-service.ts):
 *  - reads `PaymentQuote` (not `Payment`), keyed by `payToken`
 *  - reuses the calculator builder `buildCheckoutSessionParams` so a quote with
 *    monthly lines becomes a Stripe **subscription** (due-today on invoice #1 +
 *    recurring monthly), else a one-time **payment**
 *  - tags the session with `metadata.quotePayToken` — the Phase-4 webhook routes
 *    side-effects on this key (deposit sessions use `metadata.payToken`; the two
 *    keys never collide so deposit routing is untouched)
 *
 * Security: amounts are NEVER trusted from the client. The charged line items are
 * rebuilt source-aware (`rebuildQuoteForCheckout`): calculator quotes recompute
 * from the frozen `inputSnapshot` via `calculateCheckoutQuote()` (deterministic +
 * rate-validated); custom quotes read their frozen `lineItems` straight back from
 * `resultSnapshot` (re-validated, no recompute). Either way the token only ever
 * charges the amount frozen at send time.
 */
import Stripe from 'stripe'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { buildCheckoutSessionParams, isUnsafeProductionReturnUrl } from '../stripe/checkout'
import { markPaymentQuoteStatus, persistStripeCheckoutSession } from '../stripe/persistence'
import { rebuildQuoteForCheckout, resolveQuoteCouponOptions } from '../stripe/quote-rebuild'
import { ensureStripeCustomerForClient } from '../stripe/stripe-customer-link-service'
import { buildQuotePayUrl } from './quote-send-service'
import {
  BOOKKEEPING_SERVICE_LABEL,
  BOOKKEEPING_SETUP_LABEL,
  isBusinessTaxReturnPrepayLine,
} from '@ella/shared/pricing'

/** Route-friendly error with a stable code; handlers map codes to statuses. */
export class QuoteCheckoutError extends Error {
  constructor(
    readonly code: 'ALREADY_PAID' | 'NOT_PAYABLE' | 'STRIPE_MISSING_URL',
    message: string
  ) {
    super(message)
    this.name = 'QuoteCheckoutError'
  }
}

// A quote is settled (no longer payable) once the webhook flips it to one of
// these. `active` = live subscription; `paid` = one-time charge captured.
const PAID_STATUSES = ['paid', 'active'] as const
const CANCELED_STATUSES = ['canceled'] as const

let stripeClient: Stripe | null = null
function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

/**
 * Quote-specific config assertion. Like the deposit flow, the return URL is
 * derived from PORTAL_URL (not STRIPE_*_URL), so validate that here rather than
 * reusing `assertStripeCheckoutConfig`.
 */
function assertQuoteCheckoutConfig(payUrl: string): void {
  if (!config.stripe.isConfigured) {
    throw new Error('Stripe is not configured')
  }
  if (config.nodeEnv === 'production' && isUnsafeProductionReturnUrl(payUrl)) {
    throw new Error('PORTAL_URL must be a valid public HTTPS URL for quote payments in production')
  }
}

interface QuoteLineView {
  label: string
  /** Free-form detail (custom links only); absent on calculator lines. */
  description?: string
  amount: number
  kind: 'monthly' | 'yearly' | 'setup'
}

interface QuoteDiscountView {
  code: string
  name: string | null
  amount: number
  recurringAmount: number
}

/** Recurring cadence of the monthly group; null when the quote is one-time only. */
export type QuoteBillingInterval = 'month' | 'year' | null

/** Minimal public payload for the portal quote page — no PII beyond first name. */
export interface PublicQuoteView {
  orgName: string
  recipientFirstName: string | null
  lineItems: QuoteLineView[]
  monthlyTotal: number
  setupTotal: number
  subtotal: number
  discount: QuoteDiscountView | null
  /** Recurring cadence for the "Then $X/…" row; null = one-time only. */
  billingInterval: QuoteBillingInterval
  /** Charged at checkout after any pre-applied coupon. */
  dueToday: number
  status: string
  /** ISO timestamp once settled; null otherwise. */
  paidAt: string | null
}

const quoteWithRecipientInclude = {
  organization: { select: { name: true } },
  client: { select: { firstName: true } },
  lead: { select: { firstName: true } },
  appliedCoupon: {
    select: {
      code: true,
      name: true,
      discountType: true,
      percentOff: true,
      amountOffCents: true,
      duration: true,
      active: true,
      stripeCouponId: true,
    },
  },
} as const

/** Load the public quote view for a payToken. Null when the token is unknown. */
export async function getPublicQuoteView(payToken: string): Promise<PublicQuoteView | null> {
  const quote = await prisma.paymentQuote.findUnique({
    where: { payToken },
    include: quoteWithRecipientInclude,
  })
  if (!quote) return null

  const snapshot = parseResultSnapshot(quote.resultSnapshot, quote.source)
  const monthlyTotal = quote.monthlyTotalCents / 100
  const setupTotal = quote.setupTotalCents / 100
  const dueTodayCents = quote.monthlyTotalCents + quote.setupTotalCents
  const discount = calculateQuoteDiscount({
    coupon: quote.appliedCoupon,
    dueTodayCents,
    recurringCents: quote.monthlyTotalCents,
  })
  const discountAmountCents = discount ? dollarsToCents(discount.amount) : 0

  return {
    orgName: quote.organization?.name ?? 'us',
    // Signer resolution mirrors the deposit flow: prefer lead when present.
    recipientFirstName: quote.lead?.firstName ?? quote.client?.firstName ?? null,
    lineItems: snapshot,
    monthlyTotal,
    setupTotal,
    subtotal: monthlyTotal + setupTotal,
    discount,
    billingInterval: normalizeBillingInterval(quote.billingInterval),
    dueToday: centsToDollars(dueTodayCents - discountAmountCents),
    status: quote.status,
    paidAt:
      isPaidStatus(quote.status) && quote.lastStripeEventAt
        ? quote.lastStripeEventAt.toISOString()
        : null,
  }
}

/**
 * Create a fresh Stripe Checkout Session for a payable sent quote and return its
 * redirect URL. Null when the token is unknown. Throws `QuoteCheckoutError` for
 * already-paid / canceled / missing-URL cases (handlers map codes to statuses).
 */
export async function createQuoteCheckoutSession(
  payToken: string
): Promise<{ checkoutUrl: string } | null> {
  const payUrl = buildQuotePayUrl(payToken)
  assertQuoteCheckoutConfig(payUrl)

  const quote = await prisma.paymentQuote.findUnique({ where: { payToken } })
  if (!quote) return null

  if (isPaidStatus(quote.status)) {
    throw new QuoteCheckoutError('ALREADY_PAID', 'This quote has already been paid')
  }
  if (isCanceledStatus(quote.status)) {
    throw new QuoteCheckoutError('NOT_PAYABLE', 'This quote has been canceled')
  }

  // Reuse a still-open Checkout Session if one exists rather than minting a new
  // one on every Pay click. Without this, repeat clicks would create multiple
  // live Stripe sessions for one quote (risking duplicate subscriptions/charges)
  // and — since `stripeSessionId` is @unique — a re-`persist` of the same session
  // would also hit a unique violation. Stripe sessions self-expire (≤24h), so an
  // expired/absent session falls through to a fresh create below.
  // Note: a reused session's discount is frozen at its first-create — a coupon
  // attached/changed between Pay clicks won't apply until the session expires.
  const latestSession = await findLatestCheckoutSession(quote.id)
  if (isSettledCheckoutSessionStatus(latestSession?.status)) {
    throw new QuoteCheckoutError('ALREADY_PAID', 'This quote checkout has already been completed')
  }
  const reusable = getReusableCheckoutSessionUrl(latestSession)
  if (reusable) return { checkoutUrl: reusable }

  // Source-aware rebuild (drift-safe): calculator quotes recompute from the
  // frozen pricingInput; custom quotes read their frozen lineItems straight back.
  // The quoteId is pinned to the EXISTING row so the webhook (metadata
  // .paymentQuoteId) and session persistence both resolve back to this quote.
  const lineItems = rebuildQuoteForCheckout(quote)
  const couponOptions = await resolveQuoteCouponOptions(quote)
  const customerId =
    quote.clientId && quote.organizationId
      ? await ensureStripeCustomerForClient({
          clientId: quote.clientId,
          organizationId: quote.organizationId,
        })
      : undefined
  const customerEmail = customerId ? undefined : (quote.customerEmail ?? undefined)
  const hasRecurringLine = lineItems.some((item) => item.interval !== 'one_time')
  const customerCreation = !customerId && !hasRecurringLine && customerEmail ? 'always' : undefined

  const session = await getStripeClient().checkout.sessions.create(
    buildCheckoutSessionParams(lineItems, {
      quoteId: quote.id,
      customerId,
      customerEmail,
      customerCreation,
      successUrl: `${payUrl}?status=success`,
      cancelUrl: `${payUrl}?status=canceled`,
      metadataSource: quote.source === 'custom' ? 'custom_link' : 'pricing_calculator',
      // Discriminator for the webhook side-effects. The webhook routes on
      // metadata.paymentQuoteId; this is kept distinct from the deposit flow's
      // `payToken` so deposit routing is never affected.
      extraMetadata: { quotePayToken: payToken },
      ...couponOptions,
    }),
    { idempotencyKey: buildQuoteCheckoutIdempotencyKey(quote.id, latestSession?.stripeSessionId) }
  )

  if (!session.url) {
    await markPaymentQuoteStatus(quote.id, 'stripe_missing_url')
    throw new QuoteCheckoutError('STRIPE_MISSING_URL', 'Stripe did not return a Checkout URL')
  }

  try {
    await persistStripeCheckoutSession(quote.id, session)
  } catch (error) {
    await markPaymentQuoteStatus(quote.id, 'checkout_persist_failed')
    throw error
  }

  return { checkoutUrl: session.url }
}

/**
 * Return the URL of the most recent still-payable Checkout Session for a quote,
 * or null. "Still payable" = has a URL, isn't expired, and Stripe hasn't already
 * completed it (a completed session means money moved → the webhook will settle
 * the quote, so we must not hand back its single-use URL).
 */
async function findLatestCheckoutSession(quoteId: string): Promise<{
  stripeSessionId: string
  status: string
  url: string | null
  expiresAt: Date | null
} | null> {
  return prisma.stripeCheckoutSession.findFirst({
    where: {
      paymentQuoteId: quoteId,
    },
    orderBy: { createdAt: 'desc' },
    select: { stripeSessionId: true, status: true, url: true, expiresAt: true },
  })
}

function getReusableCheckoutSessionUrl(
  existing: Awaited<ReturnType<typeof findLatestCheckoutSession>>
): string | null {
  if (!existing?.url) return null
  if (isTerminalCheckoutSessionStatus(existing.status)) return null
  if (existing.expiresAt && existing.expiresAt <= new Date()) return null
  return existing.url
}

function isSettledCheckoutSessionStatus(status: string | null | undefined): boolean {
  return Boolean(status && ['complete', 'invoice_paid'].includes(status))
}

function isTerminalCheckoutSessionStatus(status: string): boolean {
  return [
    'complete',
    'expired',
    'invoice_paid',
    'payment_failed',
    'invoice_payment_failed',
    'subscription_canceled',
  ].includes(status)
}

function buildQuoteCheckoutIdempotencyKey(
  quoteId: string,
  previousSessionId: string | null | undefined
): string {
  return `quote-checkout:${quoteId}:${previousSessionId ?? 'initial'}`
}

function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status)
}

function isCanceledStatus(status: string): boolean {
  return (CANCELED_STATUSES as readonly string[]).includes(status)
}

/** Flatten the frozen CheckoutQuote snapshot into ordered monthly→yearly→setup display lines. */
function parseResultSnapshot(snapshot: unknown, source: string): QuoteLineView[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  const { monthlyItems, setupItems } = snapshot as {
    monthlyItems?: unknown
    setupItems?: unknown
  }
  if (source === 'custom') {
    return [
      ...toLineViews(monthlyItems, 'monthly', false),
      ...toLineViews(setupItems, 'setup', false),
    ]
  }

  const setupViews = toLineViews(setupItems, 'setup')
  const yearlyViews = setupViews
    .filter(isBusinessTaxReturnPrepayLine)
    .map((item) => ({ ...item, kind: 'yearly' as const }))
  const oneTimeViews = setupViews.filter((item) => !isBusinessTaxReturnPrepayLine(item))
  return [...toLineViews(monthlyItems, 'monthly'), ...yearlyViews, ...oneTimeViews]
}

function toLineViews(
  items: unknown,
  kind: 'monthly' | 'setup',
  sanitizeCalculatorLabels = true
): QuoteLineView[] {
  if (!Array.isArray(items)) return []
  return items
    .filter((item): item is { label: string; description?: unknown; amount: number } => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof (item as { label?: unknown }).label === 'string' &&
        typeof (item as { amount?: unknown }).amount === 'number'
      )
    })
    .map((item) => {
      const description = typeof item.description === 'string' ? item.description : undefined
      return {
        label: sanitizeCalculatorLabels ? sanitizeCalculatorQuoteLabel(item.label) : item.label,
        ...(description ? { description } : {}),
        amount: item.amount,
        kind,
      }
    })
}

function sanitizeCalculatorQuoteLabel(label: string): string {
  if (/^(Basic|Pro|VIP) (tier|plan|package)$/i.test(label)) {
    return BOOKKEEPING_SERVICE_LABEL
  }
  if (/^(Basic|Pro|VIP) bookkeeping setup$/i.test(label)) {
    return BOOKKEEPING_SETUP_LABEL
  }
  return label
}

/** Narrow the stored interval column ("month" | "year" | null) to the public union. */
function normalizeBillingInterval(value: string | null): QuoteBillingInterval {
  return value === 'month' || value === 'year' ? value : null
}

interface DiscountableCoupon {
  code: string
  name: string | null
  discountType: string
  percentOff: number | null
  amountOffCents: number | null
  duration: string
  active: boolean
  stripeCouponId: string | null
}

function calculateQuoteDiscount({
  coupon,
  dueTodayCents,
  recurringCents,
}: {
  coupon: DiscountableCoupon | null
  dueTodayCents: number
  recurringCents: number
}): QuoteDiscountView | null {
  if (!coupon?.active || !coupon.stripeCouponId) return null

  const amountCents = discountCentsForSubtotal(coupon, dueTodayCents)
  if (amountCents <= 0) return null

  const recurringAmountCents =
    coupon.duration === 'once' ? 0 : discountCentsForSubtotal(coupon, recurringCents)

  return {
    code: coupon.code,
    name: coupon.name,
    amount: centsToDollars(amountCents),
    recurringAmount: centsToDollars(recurringAmountCents),
  }
}

function discountCentsForSubtotal(coupon: DiscountableCoupon, subtotalCents: number): number {
  if (subtotalCents <= 0) return 0
  if (coupon.discountType === 'percent' && coupon.percentOff != null) {
    return Math.min(subtotalCents, Math.round((subtotalCents * coupon.percentOff) / 100))
  }
  if (coupon.discountType === 'amount' && coupon.amountOffCents != null) {
    return Math.min(subtotalCents, coupon.amountOffCents)
  }
  return 0
}

function centsToDollars(cents: number): number {
  return Math.max(0, cents) / 100
}

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100)
}
