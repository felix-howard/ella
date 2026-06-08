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
 * Security: amounts are NEVER trusted from the client. The quote is rebuilt from
 * the frozen `inputSnapshot` via `calculateCheckoutQuote()` (deterministic +
 * rate-validated), so the token always charges the amount frozen at send time.
 */
import Stripe from 'stripe'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import {
  buildCheckoutSessionParams,
  isUnsafeProductionReturnUrl,
} from '../stripe/checkout'
import { calculateCheckoutQuote } from '../stripe/quote-calculator'
import { markPaymentQuoteStatus, persistStripeCheckoutSession } from '../stripe/persistence'
import { checkoutPricingInputSchema } from '../../routes/billing/schemas'
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
  amount: number
  kind: 'monthly' | 'setup'
}

/** Minimal public payload for the portal quote page — no PII beyond first name. */
export interface PublicQuoteView {
  orgName: string
  recipientFirstName: string | null
  lineItems: QuoteLineView[]
  monthlyTotal: number
  setupTotal: number
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
  const reusable = await findReusableCheckoutSession(quote.id)
  if (reusable) return { checkoutUrl: reusable }

  const pricingInput = parsePricingInput(quote.inputSnapshot)
  // Rebuild from the frozen input (deterministic + rate-validated), but pin the
  // quoteId to the EXISTING row so the webhook (metadata.paymentQuoteId) and
  // session persistence both resolve back to this quote.
  const checkoutQuote = { ...calculateCheckoutQuote(pricingInput), quoteId: quote.id }

  const session = await getStripeClient().checkout.sessions.create(
    buildCheckoutSessionParams(
      checkoutQuote,
      { pricingInput, customerEmail: quote.customerEmail ?? undefined },
      {
        successUrl: `${payUrl}?status=success`,
        cancelUrl: `${payUrl}?status=canceled`,
        // Discriminator for Phase-4 webhook side-effects. Intentionally unconsumed
        // today (the webhook routes on metadata.paymentQuoteId); kept distinct from
        // the deposit flow's `payToken` so deposit routing is never affected.
        extraMetadata: { quotePayToken: payToken },
      },
    ),
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
    .filter((item): item is { label: string; amount: number } => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof (item as { label?: unknown }).label === 'string' &&
        typeof (item as { amount?: unknown }).amount === 'number'
      )
    })
    .map((item) => ({ label: item.label, amount: item.amount, kind }))
}

/** Parse + validate the frozen pricing input. Throws CheckoutQuoteError downstream. */
function parsePricingInput(snapshot: unknown) {
  const raw =
    snapshot && typeof snapshot === 'object'
      ? (snapshot as { pricingInput?: unknown }).pricingInput
      : undefined
  return checkoutPricingInputSchema.parse(raw)
}
