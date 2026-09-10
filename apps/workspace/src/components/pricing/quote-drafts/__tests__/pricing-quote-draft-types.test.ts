import { describe, expect, it } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import { canonicalizePricingQuoteDraftInput, pricingQuoteDraftSignature } from '../pricing-quote-draft-types'

describe('Calculator draft canonical baseline', () => {
  it('ignores object key ordering and omitted legacy setup defaults', () => {
    const input = createDefaultPricingInput()
    const reordered = { ...input, cashPlan: { owners: input.cashPlan.owners, employees: input.cashPlan.employees, enabled: input.cashPlan.enabled }, rates: { ...input.rates, tiers: { vipMonthly: input.rates.tiers.vipMonthly, proMonthly: input.rates.tiers.proMonthly, basicMonthly: input.rates.tiers.basicMonthly } } }
    expect(pricingQuoteDraftSignature(reordered)).toBe(pricingQuoteDraftSignature(input))
    const legacy = structuredClone(input)
    delete legacy.rates.bookkeeping
    delete legacy.rates.payroll.setup
    expect(pricingQuoteDraftSignature(legacy)).toBe(pricingQuoteDraftSignature(input))
  })
  it('trims custom row identity and labels without mutating the editing input', () => {
    const input = createDefaultPricingInput()
    input.customItems = [{ id: ' row-1 ', label: ' Advisory ', amount: 80, quantity: 2, billingInterval: 'month' }]
    const before = structuredClone(input)
    const canonical = canonicalizePricingQuoteDraftInput(input)
    expect(canonical.customItems[0]).toEqual({ ...input.customItems[0], id: 'row-1', label: 'Advisory' })
    expect(input).toEqual(before)
    expect(pricingQuoteDraftSignature(canonical)).toBe(pricingQuoteDraftSignature(input))
    canonical.customItems[0].amount = 90
    expect(input.customItems[0].amount).toBe(80)
    expect(pricingQuoteDraftSignature(canonical)).not.toBe(pricingQuoteDraftSignature(input))
  })
})
