import { describe, expect, it } from 'vitest'
import {
  calculatePricing,
  createDefaultPricingInput,
  detectPricingTier,
  isPricingCheckoutAmountSane,
  isPricingInputSane,
  MAX_CHECKOUT_LINE_AMOUNT,
} from './calculator'

describe('pricing calculator', () => {
  it('detects basic tier at 0 and 10 1099 workers', () => {
    expect(detectPricingTier(0)).toBe('basic')
    expect(detectPricingTier(10)).toBe('basic')
  })

  it('detects pro tier at 11 and 20 1099 workers', () => {
    expect(detectPricingTier(11)).toBe('pro')
    expect(detectPricingTier(20)).toBe('pro')
  })

  it('detects enterprise tier above 20 1099 workers', () => {
    expect(detectPricingTier(21)).toBe('enterprise')
  })

  it('keeps enterprise quotes in contact-sales state', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 21

    const result = calculatePricing(input)

    expect(result.tier).toBe('enterprise')
    expect(result.tierLabel).toBe('VIP')
    expect(result.isEnterprise).toBe(true)
  })

  it('calculates payroll and cash plan totals from current defaults', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 11
    input.payrollEmployees = 5
    input.cashPlan = { enabled: true, employees: 5, owners: 1 }

    const result = calculatePricing(input)

    expect(result.tier).toBe('pro')
    expect(result.monthlyTotal).toBe(245)
    expect(result.setupTotal).toBe(1400)
  })

  it('separates business tax return pre-pay for yearly display without changing due today', () => {
    const input = createDefaultPricingInput()
    input.oneTime = {
      startLlc: 1,
      holdingLlcNew: 0,
      holdingLlcModify: 2,
      personalTaxReturn: 3,
      businessTaxReturn: 1,
    }

    const result = calculatePricing(input)

    expect(result.monthlyTotal).toBe(75)
    expect(result.setupTotal).toBe(5000)
    expect(result.yearlyItems).toEqual([
      { label: 'Business tax return pre-pay (1 tax year)', amount: 900, kind: 'setup' },
    ])
    expect(result.yearlyTotal).toBe(900)
    expect(result.setupDisplayTotal).toBe(4100)
    expect(result.setupDisplayItems.map((item) => item.label)).not.toContain(
      'Business tax return pre-pay (1 tax year)'
    )
  })

  it('flags checkout totals that exceed the shared line amount limit', () => {
    const input = createDefaultPricingInput()
    input.rates.tiers.basicMonthly = MAX_CHECKOUT_LINE_AMOUNT + 1

    expect(isPricingCheckoutAmountSane(calculatePricing(input))).toBe(false)
  })

  it('rejects quantities beyond workspace checkout limits', () => {
    const input = createDefaultPricingInput()

    expect(isPricingInputSane({ ...input, nec1099Count: 201 })).toBe(false)
    expect(isPricingInputSane({ ...input, payrollEmployees: 201 })).toBe(false)
    expect(isPricingInputSane({ ...input, cashPlan: { ...input.cashPlan, employees: 201 } })).toBe(
      false
    )
    expect(isPricingInputSane({ ...input, cashPlan: { ...input.cashPlan, owners: 100 } })).toBe(
      false
    )
    expect(isPricingInputSane({ ...input, oneTime: { ...input.oneTime, startLlc: 100 } })).toBe(
      false
    )
    expect(isPricingInputSane({ ...input, salesTaxShops: 201 })).toBe(false)
  })
})
