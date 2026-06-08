import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getActiveCouponById } = vi.hoisted(() => ({ getActiveCouponById: vi.fn() }))
vi.mock('../../coupons/coupon-service', () => ({ getActiveCouponById }))

import {
  rebuildQuoteForCheckout,
  resolveQuoteCouponOptions,
  type RebuildableQuote,
} from '../quote-rebuild'

const customSnapshot = {
  quoteId: 'quote_custom',
  monthlyItems: [{ label: 'Retainer', amount: 300, kind: 'monthly' }],
  setupItems: [{ label: 'Onboarding', amount: 150, kind: 'setup' }],
  monthlyTotal: 300,
  setupTotal: 150,
  lineItems: [
    { label: 'Retainer', unitAmountCents: 30000, quantity: 1, interval: 'month' },
    { label: 'Onboarding', unitAmountCents: 15000, quantity: 1, interval: 'one_time' },
  ],
}

const baseQuote: RebuildableQuote = {
  source: 'custom',
  inputSnapshot: { source: 'custom', billingInterval: 'month' },
  resultSnapshot: customSnapshot,
  appliedCouponId: null,
  allowPromotionCodes: false,
  organizationId: 'org_1',
}

// Minimal valid calculator pricing input (NEC-1099 only → one billable monthly line).
const calculatorPricingInput = {
  nec1099Count: 10,
  payrollEmployees: 0,
  payrollMode: 'owner-manual',
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  rates: {
    tiers: { basicMonthly: 75, proMonthly: 85, vipMonthly: 85 },
    payroll: { baseMonthly: 50 },
    cashPlan: { setup: 1000, perEmployeeMonthly: 5, perOwnerMonthly: 50 },
    auditProtection: { monthly: 300, setup: 1000 },
    oneTime: {
      startLlc: 1500,
      holdingLlcNew: 4000,
      holdingLlcModify: 1000,
      personalTaxReturn: 150,
      businessTaxReturnFederal: 600,
      businessTaxReturnState: 100,
    },
    salesTaxMonitoringMonthly: 25,
  },
}

describe('rebuildQuoteForCheckout', () => {
  it('reads frozen line items straight back for a custom quote (no recompute)', () => {
    const items = rebuildQuoteForCheckout(baseQuote)
    expect(items).toEqual(customSnapshot.lineItems)
  })

  it('throws when a custom snapshot has no line items', () => {
    expect(() =>
      rebuildQuoteForCheckout({ ...baseQuote, resultSnapshot: { lineItems: [] } })
    ).toThrow()
  })

  it('throws when a custom line item is malformed', () => {
    expect(() =>
      rebuildQuoteForCheckout({
        ...baseQuote,
        resultSnapshot: { lineItems: [{ label: 'x', unitAmountCents: -1, quantity: 1, interval: 'month' }] },
      })
    ).toThrow()
  })

  it('recomputes a calculator quote from the frozen pricing input', () => {
    const items = rebuildQuoteForCheckout({
      ...baseQuote,
      source: 'calculator',
      inputSnapshot: { pricingInput: calculatorPricingInput },
    })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.unitAmountCents > 0)).toBe(true)
  })
})

describe('resolveQuoteCouponOptions', () => {
  beforeEach(() => getActiveCouponById.mockReset())

  it('returns the Stripe coupon id for an active pre-applied coupon', async () => {
    getActiveCouponById.mockResolvedValue({ stripeCouponId: 'coupon_live' })
    const opts = await resolveQuoteCouponOptions({ ...baseQuote, appliedCouponId: 'cpn_1' })
    expect(opts).toEqual({ stripeCouponId: 'coupon_live' })
    expect(getActiveCouponById).toHaveBeenCalledWith('cpn_1', 'org_1')
  })

  it('falls back to promo codes when no coupon is attached', async () => {
    const opts = await resolveQuoteCouponOptions({ ...baseQuote, allowPromotionCodes: true })
    expect(opts).toEqual({ allowPromotionCodes: true })
    expect(getActiveCouponById).not.toHaveBeenCalled()
  })

  it('returns empty options when an attached coupon is inactive/unsynced', async () => {
    getActiveCouponById.mockResolvedValue(null)
    const opts = await resolveQuoteCouponOptions({ ...baseQuote, appliedCouponId: 'cpn_gone' })
    expect(opts).toEqual({})
  })

  it('prefers the coupon over promo codes (never both)', async () => {
    getActiveCouponById.mockResolvedValue({ stripeCouponId: 'coupon_live' })
    const opts = await resolveQuoteCouponOptions({
      ...baseQuote,
      appliedCouponId: 'cpn_1',
      allowPromotionCodes: true,
    })
    expect(opts).toEqual({ stripeCouponId: 'coupon_live' })
  })
})
