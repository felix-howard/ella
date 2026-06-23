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

  it('adds monthly custom items to monthly lines and totals', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom_monthly_1',
        label: 'Advisory add-on',
        amount: 25,
        quantity: 2,
        billingInterval: 'month',
      },
    ]

    const result = calculatePricing(input)

    expect(result.monthlyItems).toContainEqual({
      label: 'Advisory add-on × 2',
      amount: 50,
      kind: 'monthly',
    })
    expect(result.monthlyTotal).toBe(125)
  })

  it('adds one-time custom items to setup lines and totals', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom_once_1',
        label: 'Clean-up project',
        amount: 100,
        quantity: 3,
        billingInterval: 'one_time',
      },
    ]

    const result = calculatePricing(input)

    expect(result.setupItems).toContainEqual({
      label: 'Clean-up project × 3',
      amount: 300,
      kind: 'setup',
    })
    expect(result.setupTotal).toBe(450)
  })

  it('does not treat custom-only input as a meaningful calculator selection', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom_only',
        label: 'Staff-entered add-on',
        amount: 50,
        quantity: 1,
        billingInterval: 'month',
      },
    ]

    expect(calculatePricing(input).hasAnySelection).toBe(false)
  })

  it('keeps custom one-time items out of yearly pre-pay grouping', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom_once_1',
        label: 'Business tax return pre-pay (1 tax year)',
        amount: 100,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    const result = calculatePricing(input)

    expect(result.yearlyItems).toEqual([])
    expect(result.setupDisplayItems).toContainEqual({
      label: 'Business tax return pre-pay (1 tax year)',
      amount: 100,
      kind: 'setup',
    })
  })

  it('keeps legacy input without customItems sane and calculable', () => {
    const input = createDefaultPricingInput()
    delete (input as Partial<typeof input>).customItems

    expect(isPricingInputSane(input)).toBe(true)
    expect(calculatePricing(input).monthlyTotal).toBe(75)
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
