import Stripe from 'stripe'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import {
  classifyStripeCheckoutSession,
  getExpandedPaymentIntent,
  getStripeObjectId,
  isStripeResourceMissingError,
  type ReconciledCheckoutSession,
} from './quote-stripe-reconciliation-classifier'

const RECONCILABLE_QUOTE_STATUSES = new Set([
  'pending_checkout',
  'sent',
  'checkout_created',
  'stripe_create_failed',
  'checkout_persist_failed',
  'stripe_missing_url',
  'awaiting_payment',
  'payment_failed',
  'canceled',
])

const PAID_QUOTE_STATUSES = new Set(['paid', 'active'])
const RECONCILIATION_STALE_MS = 30_000

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(config.stripe.secretKey)
  return stripeClient
}

export interface QuoteReconciliationResult {
  status: 'skipped' | 'verified' | 'unverified'
  quoteId?: string
}

export async function reconcileQuotePaymentFromStripe(
  payToken: string
): Promise<QuoteReconciliationResult> {
  if (!config.stripe.isConfigured) return { status: 'skipped' }

  const quote = await prisma.paymentQuote.findUnique({
    where: { payToken },
    select: {
      id: true,
      status: true,
      checkoutSessions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          stripeSessionId: true,
          status: true,
          lastStripeEventAt: true,
          expiresAt: true,
        },
      },
    },
  })
  if (!quote || !shouldReconcileQuote(quote.status)) return { status: 'skipped' }

  for (const localSession of quote.checkoutSessions ?? []) {
    if (!shouldRetrieveSession(quote.status, localSession)) continue
    try {
      const session = await getStripeClient().checkout.sessions.retrieve(
        localSession.stripeSessionId,
        {
          expand: [
            'payment_intent',
            'invoice',
            'invoice.payment_intent',
            'subscription',
            'subscription.latest_invoice',
            'subscription.latest_invoice.payment_intent',
          ],
        }
      )
      const outcome = classifyStripeCheckoutSession(session, new Date())
      await persistReconciledSession(quote.id, quote.status, session, outcome)
      if (outcome.quoteStatus) return { status: 'verified', quoteId: quote.id }
    } catch (error) {
      if (!isStripeResourceMissingError(error)) {
        console.error(
          `[QuotePayment] Stripe reconcile failed for quote=${quote.id} session=${redactStripeId(localSession.stripeSessionId)}:`,
          error
        )
        return { status: 'unverified', quoteId: quote.id }
      }
    }
  }

  return { status: 'verified', quoteId: quote.id }
}

async function persistReconciledSession(
  quoteId: string,
  currentQuoteStatus: string,
  session: Stripe.Checkout.Session,
  outcome: ReconciledCheckoutSession
): Promise<void> {
  const operations = []
  operations.push(
    prisma.stripeCheckoutSession.updateMany({
      where: {
        stripeSessionId: session.id,
        OR: buildFreshnessWhere(outcome.eventAt),
      },
      data: {
        stripeCustomerId: getStripeObjectId(session.customer),
        stripeInvoiceId: getStripeObjectId(session.invoice),
        stripeSubscriptionId: getStripeObjectId(session.subscription),
        stripePaymentIntentId: getStripeObjectId(getExpandedPaymentIntent(session)),
        status: outcome.sessionStatus,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
        lastStripeEventAt: outcome.eventAt,
        ...(outcome.paidAt ? { paidAt: outcome.paidAt } : {}),
      },
    })
  )

  if (outcome.quoteStatus && shouldUpdateQuoteStatus(currentQuoteStatus, outcome.quoteStatus)) {
    operations.push(
      prisma.paymentQuote.updateMany({
        where: {
          id: quoteId,
          OR: buildFreshnessWhere(outcome.eventAt),
        },
        data: {
          status: outcome.quoteStatus,
          lastStripeEventAt: outcome.eventAt,
        },
      })
    )
  }

  await prisma.$transaction(operations)
}

function shouldReconcileQuote(status: string): boolean {
  return RECONCILABLE_QUOTE_STATUSES.has(status)
}

function shouldRetrieveSession(
  quoteStatus: string,
  session: {
    status: string
    expiresAt?: Date | string | null
    lastStripeEventAt?: Date | string | null
  }
): boolean {
  if (PAID_QUOTE_STATUSES.has(quoteStatus)) return false
  if (session.status === 'payment_failed') {
    return quoteStatus !== 'payment_failed' && isStale(session.lastStripeEventAt)
  }
  if (['invoice_payment_failed', 'subscription_canceled'].includes(session.status)) {
    return quoteStatus !== 'payment_failed' && isStale(session.lastStripeEventAt)
  }
  if (session.status === 'complete') return isStale(session.lastStripeEventAt)
  if (quoteStatus === 'awaiting_payment') return isStale(session.lastStripeEventAt)
  if (quoteStatus === 'payment_failed') return isStale(session.lastStripeEventAt)

  const expiresAt = toDate(session.expiresAt)
  return Boolean(expiresAt && expiresAt <= new Date())
}

function shouldUpdateQuoteStatus(currentStatus: string, targetStatus: string): boolean {
  if (currentStatus === 'canceled') return false
  if (currentStatus === 'payment_failed' && targetStatus !== 'payment_failed') return false
  if (PAID_QUOTE_STATUSES.has(currentStatus) && !PAID_QUOTE_STATUSES.has(targetStatus)) {
    return false
  }
  return true
}

function buildFreshnessWhere(eventAt: Date) {
  return [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: eventAt } }]
}

function isStale(value: Date | string | null | undefined): boolean {
  const date = toDate(value)
  return !date || Date.now() - date.getTime() >= RECONCILIATION_STALE_MS
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function redactStripeId(value: string): string {
  return value.length <= 8 ? '[redacted]' : `${value.slice(0, 3)}...${value.slice(-4)}`
}
