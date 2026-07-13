import { isQuoteCanceled, isQuotePaid, type PublicQuoteView } from '../../lib/quote-api'
import type { PaymentErrorCode } from './payment-result-panels'

export type QuotePaymentPageState =
  | 'loading'
  | 'ready'
  | 'redirecting'
  | 'confirming'
  | 'processingBankPayment'
  | 'paid'
  | 'subscriptionCanceledAfterPayment'
  | 'error'

export interface ResolvedQuotePaymentPageState {
  pageState: Exclude<QuotePaymentPageState, 'loading' | 'redirecting'>
  errorCode?: PaymentErrorCode
}

export function resolveQuotePaymentPageState(
  data: PublicQuoteView,
  opts: { confirming: boolean }
): ResolvedQuotePaymentPageState {
  const publicPaymentState = data.publicPaymentState

  switch (publicPaymentState?.state) {
    case 'paid':
      return { pageState: 'paid' }
    case 'subscription_canceled_after_payment':
      return { pageState: 'subscriptionCanceledAfterPayment' }
    case 'processing_bank_payment':
      return { pageState: 'processingBankPayment' }
    case 'payment_failed':
      return { pageState: 'ready' }
    case 'canceled_before_payment':
      return { pageState: 'error', errorCode: 'canceled_before_payment' }
    case 'payable':
    case 'redirecting':
      return { pageState: opts.confirming ? 'confirming' : 'ready' }
  }

  if (publicPaymentState?.mayStartCheckout === false) {
    return { pageState: 'processingBankPayment' }
  }

  if (isQuotePaid(data.status)) return { pageState: 'paid' }
  if (data.status === 'awaiting_payment') return { pageState: 'processingBankPayment' }
  if (data.status === 'payment_failed') return { pageState: 'ready' }
  if (isQuoteCanceled(data.status)) {
    return { pageState: 'error', errorCode: 'canceled_before_payment' }
  }
  return { pageState: opts.confirming ? 'confirming' : 'ready' }
}
