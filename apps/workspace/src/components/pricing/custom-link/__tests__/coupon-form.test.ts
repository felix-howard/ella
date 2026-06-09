import { describe, expect, it } from 'vitest'
import {
  createEmptyCouponForm,
  validateCouponForm,
  type CouponFormState,
} from '../coupons/coupon-form-state'
import {
  discountSummary,
  durationSummary,
  redemptionSummary,
} from '../coupons/coupon-format'
import type { CouponSummary } from '../../../../lib/api-client'

function baseForm(overrides: Partial<CouponFormState> = {}): CouponFormState {
  return { ...createEmptyCouponForm(), code: 'WELCOME10', percentOff: '10', ...overrides }
}

describe('validateCouponForm', () => {
  it('builds a percent payload from a clean form', () => {
    const { errors, payload } = validateCouponForm(baseForm())
    expect(errors).toEqual({})
    expect(payload).toMatchObject({ code: 'WELCOME10', discountType: 'percent', percentOff: 10 })
    expect(payload?.amountOffCents).toBeUndefined()
  })

  it('converts dollar amount to cents for amount coupons', () => {
    const { payload } = validateCouponForm(
      baseForm({ discountType: 'amount', percentOff: '', amountOff: '100' })
    )
    expect(payload).toMatchObject({ discountType: 'amount', amountOffCents: 10000 })
    expect(payload?.percentOff).toBeUndefined()
  })

  it('rejects percent outside 1..100', () => {
    expect(validateCouponForm(baseForm({ percentOff: '0' })).errors.percentOff).toBeDefined()
    expect(validateCouponForm(baseForm({ percentOff: '101' })).errors.percentOff).toBeDefined()
  })

  it('requires months when duration is repeating', () => {
    const result = validateCouponForm(baseForm({ duration: 'repeating' }))
    expect(result.errors.durationInMonths).toBeDefined()
    expect(result.payload).toBeNull()
    const ok = validateCouponForm(baseForm({ duration: 'repeating', durationInMonths: '3' }))
    expect(ok.payload).toMatchObject({ duration: 'repeating', durationInMonths: 3 })
  })

  it('rejects an empty or malformed code', () => {
    expect(validateCouponForm(baseForm({ code: '' })).errors.code).toBeDefined()
    expect(validateCouponForm(baseForm({ code: 'bad code!' })).errors.code).toBeDefined()
  })

  it('rejects a past expiry date', () => {
    expect(validateCouponForm(baseForm({ redeemBy: '2000-01-01' })).errors.redeemBy).toBeDefined()
  })

  it('accepts a future expiry as a local end-of-day instant', () => {
    const { errors, payload } = validateCouponForm(baseForm({ redeemBy: '2999-12-31' }))
    expect(errors.redeemBy).toBeUndefined()
    expect(payload?.redeemBy).toBeDefined()
  })

  it('rejects an amount-off above the cap with an accurate message', () => {
    const result = validateCouponForm(
      baseForm({ discountType: 'amount', percentOff: '', amountOff: '20000000' })
    )
    expect(result.errors.amountOff).toBe('Amount off is too large.')
    expect(result.payload).toBeNull()
  })

  it('omits optional fields when blank', () => {
    const { payload } = validateCouponForm(baseForm())
    expect(payload?.maxRedemptions).toBeUndefined()
    expect(payload?.redeemBy).toBeUndefined()
    expect(payload?.name).toBeUndefined()
  })
})

describe('coupon-format', () => {
  const coupon = (overrides: Partial<CouponSummary> = {}): CouponSummary => ({
    id: 'c1',
    code: 'WELCOME10',
    name: null,
    discountType: 'percent',
    percentOff: 10,
    amountOffCents: null,
    currency: 'usd',
    duration: 'once',
    durationInMonths: null,
    maxRedemptions: null,
    redeemBy: null,
    timesRedeemed: 3,
    active: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  })

  it('summarizes percent and amount discounts', () => {
    expect(discountSummary(coupon())).toBe('10% off')
    expect(
      discountSummary(coupon({ discountType: 'amount', percentOff: null, amountOffCents: 10000 }))
    ).toBe('$100.00 off')
  })

  it('summarizes duration including repeating months', () => {
    expect(durationSummary(coupon())).toBe('Once')
    expect(durationSummary(coupon({ duration: 'repeating', durationInMonths: 3 }))).toBe('3 months')
  })

  it('shows redemption count with and without a cap', () => {
    expect(redemptionSummary(coupon())).toBe('3')
    expect(redemptionSummary(coupon({ maxRedemptions: 100 }))).toBe('3 / 100')
  })
})
