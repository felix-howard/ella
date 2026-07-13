export const PUBLIC_QUOTE_PAYMENT_STATES = [
  'payable',
  'redirecting',
  'processing_bank_payment',
  'paid',
  'payment_failed',
  'canceled_before_payment',
  'subscription_canceled_after_payment',
] as const

export type PublicQuotePaymentStateValue = (typeof PUBLIC_QUOTE_PAYMENT_STATES)[number]
export type PublicQuotePaymentMethodFamily = 'card' | 'bank' | 'unknown'
export type PublicQuoteProcessingExplanationKey = 'ach_bank_payment_settlement'

export interface PublicQuotePaymentState {
  state: PublicQuotePaymentStateValue
  paymentMethodFamily: PublicQuotePaymentMethodFamily
  processingExplanationKey: PublicQuoteProcessingExplanationKey | null
  mayStartCheckout: boolean
  timestamps: {
    latestCheckoutSessionCreatedAt: string | null
    latestCheckoutSessionUpdatedAt: string | null
    latestCheckoutSessionExpiresAt: string | null
    latestStripeEventAt: string | null
    paidAt: string | null
  }
}

export interface QuotePublicPaymentSession {
  status: string
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  expiresAt?: Date | string | null
  paidAt?: Date | string | null
  lastStripeEventAt?: Date | string | null
}

export interface QuotePublicPaymentLedgerRow {
  status: string
  paidAt?: Date | string | null
  paymentMethodBrand?: string | null
}

export interface QuotePublicPaymentStateInput {
  status: string
  lastStripeEventAt?: Date | string | null
  checkoutSessions?: QuotePublicPaymentSession[] | null
  payments?: QuotePublicPaymentLedgerRow[] | null
}

const PAID_QUOTE_STATUSES = new Set(['paid', 'active'])
const OPEN_CHECKOUT_SESSION_STATUSES = new Set(['created', 'open'])
const PAYMENT_FAILED_SESSION_STATUSES = new Set(['payment_failed'])

export function buildQuotePublicPaymentState(
  input: QuotePublicPaymentStateInput
): PublicQuotePaymentState {
  const sessions = sortSessions(input.checkoutSessions ?? [])
  const latestSession = sessions[0] ?? null
  const paidAt = resolvePaidAt(input, sessions, input.payments ?? [])
  const hasPaidEvidence = Boolean(paidAt) || PAID_QUOTE_STATUSES.has(input.status)

  if (input.status === 'canceled' && hasPaidEvidence) {
    return stateResult('subscription_canceled_after_payment', input, sessions, paidAt)
  }
  if (hasPaidEvidence && sessions.some((session) => session.status === 'subscription_canceled')) {
    return stateResult('subscription_canceled_after_payment', input, sessions, paidAt)
  }
  if (hasPaidEvidence) {
    return stateResult('paid', input, sessions, paidAt)
  }
  if (input.status === 'awaiting_payment') {
    return stateResult('processing_bank_payment', input, sessions, paidAt)
  }
  if (
    input.status === 'payment_failed' ||
    PAYMENT_FAILED_SESSION_STATUSES.has(latestSession?.status ?? '')
  ) {
    return stateResult('payment_failed', input, sessions, paidAt)
  }
  if (input.status === 'canceled') {
    return stateResult('canceled_before_payment', input, sessions, paidAt)
  }
  if (isReusableCheckoutSession(latestSession)) {
    return stateResult('redirecting', input, sessions, paidAt)
  }
  return stateResult('payable', input, sessions, paidAt)
}

function stateResult(
  state: PublicQuotePaymentStateValue,
  input: QuotePublicPaymentStateInput,
  sessions: QuotePublicPaymentSession[],
  paidAt: Date | null
): PublicQuotePaymentState {
  const latestSession = sessions[0] ?? null
  return {
    state,
    paymentMethodFamily: paymentMethodFamilyFor(state, latestSession, input.payments ?? []),
    processingExplanationKey:
      state === 'processing_bank_payment' ? 'ach_bank_payment_settlement' : null,
    mayStartCheckout: ['payable', 'redirecting', 'payment_failed'].includes(state),
    timestamps: {
      latestCheckoutSessionCreatedAt: toIso(latestSession?.createdAt),
      latestCheckoutSessionUpdatedAt: toIso(latestSession?.updatedAt),
      latestCheckoutSessionExpiresAt: toIso(latestSession?.expiresAt),
      latestStripeEventAt: toIso(
        latestDate([input.lastStripeEventAt, ...sessions.map((s) => s.lastStripeEventAt)])
      ),
      paidAt: toIso(paidAt),
    },
  }
}

function paymentMethodFamilyFor(
  state: PublicQuotePaymentStateValue,
  latestSession: QuotePublicPaymentSession | null,
  payments: QuotePublicPaymentLedgerRow[]
): PublicQuotePaymentMethodFamily {
  if (state === 'processing_bank_payment') return 'bank'
  if (state === 'payment_failed' && latestSession?.status === 'payment_failed') return 'bank'
  if (payments.some((payment) => Boolean(payment.paymentMethodBrand))) return 'card'
  return 'unknown'
}

function resolvePaidAt(
  input: QuotePublicPaymentStateInput,
  sessions: QuotePublicPaymentSession[],
  payments: QuotePublicPaymentLedgerRow[]
): Date | null {
  const paidPayment = payments.find(
    (payment) => payment.status === 'PAID' && toDate(payment.paidAt)
  )
  if (paidPayment) return toDate(paidPayment.paidAt)

  const paidSession = sessions.find((session) => toDate(session.paidAt))
  if (paidSession) return toDate(paidSession.paidAt)

  return PAID_QUOTE_STATUSES.has(input.status) ? toDate(input.lastStripeEventAt) : null
}

function isReusableCheckoutSession(session: QuotePublicPaymentSession | null): boolean {
  if (!session) return false
  if (!OPEN_CHECKOUT_SESSION_STATUSES.has(session.status)) return false
  const expiresAt = toDate(session.expiresAt)
  return !expiresAt || expiresAt > new Date()
}

function sortSessions(sessions: QuotePublicPaymentSession[]): QuotePublicPaymentSession[] {
  return [...sessions].sort((a, b) => {
    return timestamp(b.createdAt) - timestamp(a.createdAt)
  })
}

function latestDate(values: Array<Date | string | null | undefined>): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    const date = toDate(value)
    if (!date) return latest
    return !latest || date > latest ? date : latest
  }, null)
}

function timestamp(value: Date | string | null | undefined): number {
  return toDate(value)?.getTime() ?? 0
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIso(value: Date | string | null | undefined): string | null {
  return toDate(value)?.toISOString() ?? null
}
