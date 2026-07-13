import { describe, expect, it } from 'vitest'
import { buildQuotePublicPaymentState } from '../quote-public-payment-state'

describe('buildQuotePublicPaymentState', () => {
  it('reports settled card-compatible payments as paid without changing legacy status', () => {
    const paidAt = new Date('2026-07-01T10:00:00.000Z')

    const state = buildQuotePublicPaymentState({
      status: 'paid',
      lastStripeEventAt: paidAt,
      payments: [{ status: 'PAID', paidAt, paymentMethodBrand: 'visa' }],
      checkoutSessions: [
        {
          status: 'complete',
          paidAt,
          createdAt: '2026-07-01T09:55:00.000Z',
          updatedAt: paidAt,
          lastStripeEventAt: paidAt,
        },
      ],
    })

    expect(state.state).toBe('paid')
    expect(state.mayStartCheckout).toBe(false)
    expect(state.paymentMethodFamily).toBe('card')
    expect(state.timestamps.paidAt).toBe(paidAt.toISOString())
  })

  it('maps ACH async completion before settlement to processing bank payment', () => {
    const completedAt = new Date('2026-07-01T10:00:00.000Z')

    const state = buildQuotePublicPaymentState({
      status: 'awaiting_payment',
      lastStripeEventAt: completedAt,
      checkoutSessions: [
        {
          status: 'complete',
          createdAt: '2026-07-01T09:55:00.000Z',
          updatedAt: completedAt,
          lastStripeEventAt: completedAt,
        },
      ],
    })

    expect(state.state).toBe('processing_bank_payment')
    expect(state.paymentMethodFamily).toBe('bank')
    expect(state.processingExplanationKey).toBe('ach_bank_payment_settlement')
    expect(state.mayStartCheckout).toBe(false)
    expect(state.timestamps.paidAt).toBeNull()
  })

  it('allows retry only after an async bank payment failure', () => {
    const failedAt = new Date('2026-07-02T10:00:00.000Z')

    const state = buildQuotePublicPaymentState({
      status: 'payment_failed',
      lastStripeEventAt: failedAt,
      checkoutSessions: [
        {
          status: 'payment_failed',
          createdAt: '2026-07-01T09:55:00.000Z',
          updatedAt: failedAt,
          lastStripeEventAt: failedAt,
        },
      ],
    })

    expect(state.state).toBe('payment_failed')
    expect(state.paymentMethodFamily).toBe('bank')
    expect(state.mayStartCheckout).toBe(true)
    expect(state.timestamps.latestStripeEventAt).toBe(failedAt.toISOString())
  })

  it('does not turn a paid quote into no-charge canceled after subscription deletion', () => {
    const paidAt = new Date('2026-07-01T10:00:00.000Z')
    const canceledAt = new Date('2026-07-10T10:00:00.000Z')

    const state = buildQuotePublicPaymentState({
      status: 'canceled',
      lastStripeEventAt: canceledAt,
      checkoutSessions: [
        {
          status: 'subscription_canceled',
          paidAt,
          createdAt: '2026-07-01T09:55:00.000Z',
          updatedAt: canceledAt,
          lastStripeEventAt: canceledAt,
        },
      ],
    })

    expect(state.state).toBe('subscription_canceled_after_payment')
    expect(state.mayStartCheckout).toBe(false)
    expect(state.timestamps.paidAt).toBe(paidAt.toISOString())
    expect(state.timestamps.latestStripeEventAt).toBe(canceledAt.toISOString())
  })

  it('reports subscription cancellation after payment when quote status remains active', () => {
    const paidAt = new Date('2026-07-01T10:00:00.000Z')
    const canceledAt = new Date('2026-07-10T10:00:00.000Z')

    const state = buildQuotePublicPaymentState({
      status: 'active',
      lastStripeEventAt: paidAt,
      checkoutSessions: [
        {
          status: 'subscription_canceled',
          paidAt,
          createdAt: '2026-07-01T09:55:00.000Z',
          updatedAt: canceledAt,
          lastStripeEventAt: canceledAt,
        },
      ],
      payments: [{ status: 'PAID', paidAt }],
    })

    expect(state.state).toBe('subscription_canceled_after_payment')
    expect(state.mayStartCheckout).toBe(false)
    expect(state.timestamps.paidAt).toBe(paidAt.toISOString())
    expect(state.timestamps.latestStripeEventAt).toBe(canceledAt.toISOString())
  })

  it('keeps a canceled quote with no money moved separate from paid cancellation', () => {
    const state = buildQuotePublicPaymentState({
      status: 'canceled',
      lastStripeEventAt: '2026-07-01T10:00:00.000Z',
      checkoutSessions: [],
    })

    expect(state.state).toBe('canceled_before_payment')
    expect(state.mayStartCheckout).toBe(false)
    expect(state.timestamps.paidAt).toBeNull()
  })
})
