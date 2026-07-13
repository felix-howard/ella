import { describe, expect, it } from 'vitest'
import en from '../../locales/en.json'
import vi from '../../locales/vi.json'

describe('payment locale copy', () => {
  it('keeps no-charge copy limited to before-payment cancellation', () => {
    expect(en['pay.error.canceled_before_payment.message']).toContain('No charge was made')
    expect(vi['pay.error.canceled_before_payment.message']).toContain('chưa bị trừ tiền')

    expect(en['pay.subscriptionCanceledAfterPayment.message']).toContain('payment')
    expect(en['pay.subscriptionCanceledAfterPayment.message']).toContain('received')
    expect(en['pay.subscriptionCanceledAfterPayment.message']).not.toContain('No charge was made')

    expect(vi['pay.subscriptionCanceledAfterPayment.message']).toContain('đã được nhận')
    expect(vi['pay.subscriptionCanceledAfterPayment.message']).not.toContain('chưa bị trừ tiền')
  })
})
