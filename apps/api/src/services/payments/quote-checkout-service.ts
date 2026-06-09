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
import {
  buildCheckoutSessionParams,
  isUnsafeProductionReturnUrl,
} from '../stripe/checkout'
import { markPaymentQuoteStatus, persistStripeCheckoutSession } from '../stripe/persistence'
import { rebuildQuoteForCheckout, resolveQuoteCouponOptions } from '../stripe/quote-rebuild'
import { buildQuotePayUrl } from './quote-send-service'

/** Route-friendly error with a stable code; handlers map codes to statuses. */
export class QuoteCheckoutError extends Error {
  constructor(
    readonly code: 'ALREADY_PAID' | 'NOT_PAYABLE' | 'STRIPE_MISSING_URL',
    message: string,
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
  kind: 'monthly' | 'setup'
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
  /** Recurring cadence for the "Then $X/…" row; null = one-time only. */
  billingInterval: QuoteBillingInterval
  /** Charged at checkout: monthlyTotal (first invoice) + setupTotal. */
  dueToday: number
  status: string
  /** ISO timestamp once settled; null otherwise. */
  paidAt: string | null
}

const quoteWithRecipientInclude = {
  organization: { select: { name: true } },
  client: { select: { firstName: true } },
  lead: { select: { firstName: true } },
} as const

/** Load the public quote view for a payToken. Null when the token is unknown. */
export async function getPublicQuoteView(payToken: string): Promise<PublicQuoteView | null> {
  const quote = await prisma.paymentQuote.findUnique({
    where: { payToken },
    include: quoteWithRecipientInclude,
  })
  if (!quote) return null

  const snapshot = parseResultSnapshot(quote.resultSnapshot)
  const monthlyTotal = quote.monthlyTotalCents / 100
  const setupTotal = quote.setupTotalCents / 100

  return {
    orgName: quote.organization?.name ?? 'us',
    // Signer resolution mirrors the deposit flow: prefer lead when present.
    recipientFirstName: quote.lead?.firstName ?? quote.client?.firstName ?? null,
    lineItems: snapshot,
    monthlyTotal,
    setupTotal,
    billingInterval: normalizeBillingInterval(quote.billingInterval),
    dueToday: monthlyTotal + setupTotal,
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
  payToken: string,
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
  const reusable = await findReusableCheckoutSession(quote.id)
  if (reusable) return { checkoutUrl: reusable }

  // Source-aware rebuild (drift-safe): calculator quotes recompute from the
  // frozen pricingInput; custom quotes read their frozen lineItems straight back.
  // The quoteId is pinned to the EXISTING row so the webhook (metadata
  // .paymentQuoteId) and session persistence both resolve back to this quote.
  const lineItems = rebuildQuoteForCheckout(quote)
  const couponOptions = await resolveQuoteCouponOptions(quote)

  const session = await getStripeClient().checkout.sessions.create(
    buildCheckoutSessionParams(lineItems, {
      quoteId: quote.id,
      customerEmail: quote.customerEmail ?? undefined,
      successUrl: `${payUrl}?status=success`,
      cancelUrl: `${payUrl}?status=canceled`,
      metadataSource: quote.source === 'custom' ? 'custom_link' : 'pricing_calculator',
      // Discriminator for the webhook side-effects. The webhook routes on
      // metadata.paymentQuoteId; this is kept distinct from the deposit flow's
      // `payToken` so deposit routing is never affected.
      extraMetadata: { quotePayToken: payToken },
      ...couponOptions,
    }),
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
async function findReusableCheckoutSession(quoteId: string): Promise<string | null> {
  const existing = await prisma.stripeCheckoutSession.findFirst({
    where: {
      paymentQuoteId: quoteId,
      url: { not: null },
      status: { notIn: ['complete', 'expired'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { url: true, expiresAt: true },
  })
  if (!existing?.url) return null
  if (existing.expiresAt && existing.expiresAt <= new Date()) return null
  return existing.url
}

function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status)
}

function isCanceledStatus(status: string): boolean {
  return (CANCELED_STATUSES as readonly string[]).includes(status)
}

/** Flatten the frozen CheckoutQuote snapshot into ordered monthly→setup lines. */
function parseResultSnapshot(snapshot: unknown): QuoteLineView[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  const { monthlyItems, setupItems } = snapshot as {
    monthlyItems?: unknown
    setupItems?: unknown
  }
  return [...toLineViews(monthlyItems, 'monthly'), ...toLineViews(setupItems, 'setup')]
}

function toLineViews(items: unknown, kind: 'monthly' | 'setup'): QuoteLineView[] {
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
      return { label: item.label, ...(description ? { description } : {}), amount: item.amount, kind }
    })
}

/** Narrow the stored interval column ("month" | "year" | null) to the public union. */
function normalizeBillingInterval(value: string | null): QuoteBillingInterval {
  return value === 'month' || value === 'year' ? value : null
}
