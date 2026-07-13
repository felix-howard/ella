import { buildQuotePayUrl } from '../../services/payments/quote-send-shared'
import { buildQuotePublicPaymentState } from '../../services/payments/quote-public-payment-state'
import { businessDaysSince, latestDate } from './client-quote-payment-dates'

type StaffQuotePaymentState =
  | 'sent'
  | 'processing_bank_payment'
  | 'payment_failed_retryable'
  | 'paid'
  | 'duplicate_paid_review'
  | 'subscription_canceled_after_payment'
  | 'canceled_before_payment'

interface StaffQuoteCheckoutSession {
  stripeSessionId: string
  status: string
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  paidAt: Date | null
  lastStripeEventAt: Date | null
  stripePaymentIntentId?: string | null
  stripeInvoiceId?: string | null
}

export interface StaffQuotePaymentSource {
  id: string
  source: string
  status: string
  payToken: string | null
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastStripeEventAt: Date | null
  monthlyTotalCents: number
  setupTotalCents: number
  billingInterval: string | null
  agreement: { id: string; title: string } | null
  checkoutSessions: StaffQuoteCheckoutSession[]
}

export interface StaffQuotePaymentEvidence {
  payToken: string
  stripeSessionId: string | null
  status: string
  paidAt: Date | null
  paymentMethodBrand: string | null
}

export interface SerializedClientQuotePayment {
  id: string
  source: string
  rawStatus: string
  state: StaffQuotePaymentState
  amount: string
  recurringAmount: string
  currency: 'usd'
  billingInterval: string | null
  sentAt: Date | null
  createdAt: Date
  lastStripeEventAt: string | null
  paidAt: string | null
  agreement: { id: string; title: string } | null
  payUrl: string | null
  mayStartCheckout: boolean
  latestStripeSessionId: string | null
  latestStripePaymentIntentId: string | null
  latestStripeInvoiceId: string | null
  staleProcessing: boolean
}

export interface ClientQuoteMonitoringSummary {
  bankProcessingCount: number
  staleBankProcessingCount: number
  duplicateReviewCount: number
  paymentFailedCount: number
  subscriptionCanceledAfterPaymentCount: number
}

const DUPLICATE_REVIEW_STATUS = 'duplicate_paid_review'
const STALE_PROCESSING_BUSINESS_DAYS = 5

export function serializeClientQuotePayment(
  quote: StaffQuotePaymentSource,
  evidence: StaffQuotePaymentEvidence | null,
  now = new Date(),
): SerializedClientQuotePayment {
  const publicState = buildQuotePublicPaymentState({
    status: quote.status,
    lastStripeEventAt: quote.lastStripeEventAt,
    checkoutSessions: quote.checkoutSessions,
    payments: evidence
      ? [{
          status: evidence.status,
          paidAt: evidence.paidAt,
          paymentMethodBrand: evidence.paymentMethodBrand,
        }]
      : [],
  })
  const latestSession = sortSessions(quote.checkoutSessions)[0] ?? null
  const hasDuplicateReview = quote.checkoutSessions.some(
    (session) => session.status === DUPLICATE_REVIEW_STATUS,
  )
  const state = hasDuplicateReview
    ? DUPLICATE_REVIEW_STATUS
    : mapPublicStateToStaffState(publicState.state)
  const staleProcessing =
    state === 'processing_bank_payment' &&
    businessDaysSince(latestProcessingTimestamp(quote), now) >= STALE_PROCESSING_BUSINESS_DAYS

  return {
    id: quote.id,
    source: quote.source,
    rawStatus: quote.status,
    state,
    amount: centsToAmount(quote.monthlyTotalCents + quote.setupTotalCents),
    recurringAmount: centsToAmount(quote.monthlyTotalCents),
    currency: 'usd',
    billingInterval: quote.billingInterval,
    sentAt: quote.sentAt,
    createdAt: quote.createdAt,
    lastStripeEventAt: publicState.timestamps.latestStripeEventAt,
    paidAt: publicState.timestamps.paidAt,
    agreement: quote.agreement,
    payUrl: quote.payToken ? buildQuotePayUrl(quote.payToken) : null,
    mayStartCheckout: publicState.mayStartCheckout && state !== DUPLICATE_REVIEW_STATUS,
    latestStripeSessionId: latestSession?.stripeSessionId ?? null,
    latestStripePaymentIntentId: latestSession?.stripePaymentIntentId ?? null,
    latestStripeInvoiceId: latestSession?.stripeInvoiceId ?? null,
    staleProcessing,
  }
}

export function buildClientQuoteMonitoringSummary(
  quotes: SerializedClientQuotePayment[],
): ClientQuoteMonitoringSummary {
  return quotes.reduce<ClientQuoteMonitoringSummary>(
    (summary, quote) => ({
      bankProcessingCount:
        summary.bankProcessingCount + (quote.state === 'processing_bank_payment' ? 1 : 0),
      staleBankProcessingCount:
        summary.staleBankProcessingCount + (quote.staleProcessing ? 1 : 0),
      duplicateReviewCount:
        summary.duplicateReviewCount + (quote.state === 'duplicate_paid_review' ? 1 : 0),
      paymentFailedCount:
        summary.paymentFailedCount + (quote.state === 'payment_failed_retryable' ? 1 : 0),
      subscriptionCanceledAfterPaymentCount:
        summary.subscriptionCanceledAfterPaymentCount +
        (quote.state === 'subscription_canceled_after_payment' ? 1 : 0),
    }),
    {
      bankProcessingCount: 0,
      staleBankProcessingCount: 0,
      duplicateReviewCount: 0,
      paymentFailedCount: 0,
      subscriptionCanceledAfterPaymentCount: 0,
    },
  )
}

export function firstPaymentEvidenceBySessionId(
  payments: StaffQuotePaymentEvidence[],
): Map<string, StaffQuotePaymentEvidence> {
  const bySessionId = new Map<string, StaffQuotePaymentEvidence>()
  for (const payment of payments) {
    const sessionId = payment.stripeSessionId ?? payment.payToken.replace(/^qf_/, '')
    if (!sessionId || bySessionId.has(sessionId)) continue
    bySessionId.set(sessionId, payment)
  }
  return bySessionId
}

function mapPublicStateToStaffState(state: string): StaffQuotePaymentState {
  if (state === 'processing_bank_payment') return 'processing_bank_payment'
  if (state === 'payment_failed') return 'payment_failed_retryable'
  if (state === 'paid') return 'paid'
  if (state === 'subscription_canceled_after_payment') return 'subscription_canceled_after_payment'
  if (state === 'canceled_before_payment') return 'canceled_before_payment'
  return 'sent'
}

function latestProcessingTimestamp(quote: StaffQuotePaymentSource): Date {
  return latestDate([
    quote.lastStripeEventAt,
    ...quote.checkoutSessions.map((session) => session.lastStripeEventAt),
    ...quote.checkoutSessions.map((session) => session.updatedAt),
    ...quote.checkoutSessions.map((session) => session.createdAt),
    quote.updatedAt,
    quote.sentAt,
    quote.createdAt,
  ])
}

function sortSessions(sessions: StaffQuoteCheckoutSession[]): StaffQuoteCheckoutSession[] {
  return [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}
