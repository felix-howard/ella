import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CouponManagerPanel } from '../coupons/coupon-manager-panel'

vi.mock('../coupons/use-coupons', () => ({
  useCoupons: () => ({
    coupons: [
      {
        id: 'c1',
        code: 'WELCOME10',
        name: 'Welcome Discount',
        discountType: 'percent',
        percentOff: 10,
        amountOffCents: null,
        currency: 'usd',
        duration: 'once',
        durationInMonths: null,
        maxRedemptions: null,
        redeemBy: null,
        timesRedeemed: 0,
        active: true,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
  }),
  useDisableCoupon: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}))

describe('CouponManagerPanel', () => {
  it('shows the discount-code table by default and keeps create form out of the panel', () => {
    const markup = renderToStaticMarkup(<CouponManagerPanel />)

    expect(markup).toContain('Discount codes')
    expect(markup).toContain('1 active')
    expect(markup).toContain('Add discount code')
    expect(markup).toContain('WELCOME10')
    expect(markup).toContain('10% off')
    expect(markup).not.toContain('id="coupon-code"')
    expect(markup).not.toContain('Create coupon')
  })
})
