import { describe, expect, it } from 'vitest'
import type { PublicQuotePaymentState, PublicQuoteView } from '../../lib/quote-api'
import { resolveQuotePaymentPageState } from './quote-payment-view-state'

const basePaymentState: PublicQuotePaymentState = {
  state: 'payable',
  paymentMethodFamily: 'unknown',
  processingExplanationKey: null,
  mayStartCheckout: true,
  timestamps: {
    latestCheckoutSessionCreatedAt: null,
    latestCheckoutSessionUpdatedAt: null,
    latestCheckoutSessionExpiresAt: null,
    latestStripeEventAt: null,
    paidAt: null,
  },
}

function quoteView(
  status: string,
  publicPaymentState?: PublicQuotePaymentState | null
): PublicQuoteView {
  return {
    orgName: 'Ella Tax',
    recipientFirstName: 'Ava',
    lineItems: [],
    monthlyTotal: 0,
    setupTotal: 250,
    subtotal: 250,
    discount: null,
    billingInterval: null,
    dueToday: 250,
    status,
    paidAt: null,
    publicPaymentState,
  }
}

describe('resolveQuotePaymentPageState', () => {
  it('routes ACH settlement to the dedicated bank-processing state', () => {
    expect(
      resolveQuotePaymentPageState(
        quoteView('awaiting_payment', {
          ...basePaymentState,
          state: 'processing_bank_payment',
          paymentMethodFamily: 'bank',
          processingExplanationKey: 'ach_bank_payment_settlement',
          mayStartCheckout: false,
        }),
        { confirming: true }
      )
    ).toEqual({ pageState: 'processingBankPayment' })
  })

  it('keeps failed payments payable for retry', () => {
    expect(
      resolveQuotePaymentPageState(
        quoteView('payment_failed', {
          ...basePaymentState,
          state: 'payment_failed',
        }),
        { confirming: false }
      )
    ).toEqual({ pageState: 'ready' })
  })

  it('separates subscription cancellation after payment from unpaid cancellation', () => {
    expect(
      resolveQuotePaymentPageState(
        quoteView('canceled', {
          ...basePaymentState,
          state: 'subscription_canceled_after_payment',
          mayStartCheckout: false,
        }),
        { confirming: false }
      )
    ).toEqual({ pageState: 'subscriptionCanceledAfterPayment' })

    expect(
      resolveQuotePaymentPageState(
        quoteView('canceled', {
          ...basePaymentState,
          state: 'canceled_before_payment',
          mayStartCheckout: false,
        }),
        { confirming: false }
      )
    ).toEqual({ pageState: 'error', errorCode: 'canceled_before_payment' })
  })

  it('falls back to legacy quote status when public payment state is absent', () => {
    expect(resolveQuotePaymentPageState(quoteView('paid', null), { confirming: false })).toEqual({
      pageState: 'paid',
    })
    expect(
      resolveQuotePaymentPageState(quoteView('awaiting_payment', null), { confirming: false })
    ).toEqual({
      pageState: 'processingBankPayment',
    })
    expect(resolveQuotePaymentPageState(quoteView('draft', null), { confirming: true })).toEqual({
      pageState: 'confirming',
    })
  })

  it('hides checkout when an unknown future public state is not startable', () => {
    expect(
      resolveQuotePaymentPageState(
        quoteView('sent', {
          ...basePaymentState,
          state: 'manual_review' as PublicQuotePaymentState['state'],
          mayStartCheckout: false,
        }),
        { confirming: false }
      )
    ).toEqual({ pageState: 'processingBankPayment' })
  })
})
