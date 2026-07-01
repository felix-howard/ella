import type { Agreement } from '../../lib/api-client'

export type PaymentPortalKind = 'pending_review' | 'sent' | 'paid' | 'failed' | 'canceled'

export interface AgreementPaymentPortalView {
  kind: PaymentPortalKind
  payUrl: string | null
  canSend: boolean
  canCopy: boolean
}

const sentQuoteStatuses = new Set([
  'sent',
  'checkout_created',
  'awaiting_payment',
  'invoice_paid',
])

const failedQuoteStatuses = new Set([
  'payment_failed',
  'invoice_payment_failed',
  'stripe_missing_url',
  'checkout_persist_failed',
  'stripe_create_failed',
])

export function getAgreementPaymentPortalView(
  agreement: Agreement,
): AgreementPaymentPortalView | null {
  if (
    agreement.status !== 'SIGNED' ||
    agreement.source !== 'CALCULATOR' ||
    agreement.type !== 'ENGAGEMENT_LETTER' ||
    !agreement.paymentQuote
  ) {
    return null
  }

  const quote = agreement.paymentQuote
  const payUrl = quote.payUrl ?? null
  const status = quote.status

  if (status === 'agreement_signed_review' && agreement.paymentPortalMode === 'STAFF_REVIEW') {
    return {
      kind: 'pending_review',
      payUrl,
      canSend: true,
      canCopy: Boolean(payUrl),
    }
  }

  if (status === 'paid' || status === 'active') {
    return { kind: 'paid', payUrl, canSend: false, canCopy: false }
  }

  if (status === 'canceled') {
    return { kind: 'canceled', payUrl, canSend: false, canCopy: false }
  }

  if (failedQuoteStatuses.has(status)) {
    return { kind: 'failed', payUrl, canSend: false, canCopy: Boolean(payUrl) }
  }

  if (sentQuoteStatuses.has(status) || quote.sentAt || payUrl) {
    return {
      kind: 'sent',
      payUrl,
      canSend: agreement.paymentPortalMode === 'STAFF_REVIEW' && !payUrl,
      canCopy: Boolean(payUrl),
    }
  }

  return null
}

export function hasAgreementPaymentPortalAction(agreement: Agreement): boolean {
  const view = getAgreementPaymentPortalView(agreement)
  return Boolean(view?.canSend || view?.canCopy)
}
