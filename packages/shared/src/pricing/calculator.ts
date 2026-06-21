import { PAYROLL, TIER_BASIC, TIER_ENTERPRISE, TIER_PRO } from '../constants'
import { BUSINESS_TAX_RETURN_PREPAY_LABEL, ONE_TIME_LABELS } from './pricing-defaults'
export { createDefaultPricingInput } from './pricing-defaults'

export type Tier = 'basic' | 'pro' | 'enterprise'

export type PayrollMode = 'owner-manual' | 'ella-staff'

export interface PricingCalculatorInput {
  nec1099Count: number
  payrollEmployees: number
  payrollMode: PayrollMode
  cashPlan: {
    enabled: boolean
    employees: number
    owners: number
  }
  auditProtection: boolean
  oneTime: {
    startLlc: number
    holdingLlcNew: number
    holdingLlcModify: number
    personalTaxReturn: number
    businessTaxReturn: number
  }
  salesTaxShops: number
  rates: {
    tiers: {
      basicMonthly: number
      proMonthly: number
      vipMonthly: number
    }
    payroll: {
      baseMonthly: number
    }
    cashPlan: {
      setup: number
      perEmployeeMonthly: number
      perOwnerMonthly: number
    }
    auditProtection: {
      monthly: number
      setup: number
    }
    oneTime: {
      startLlc: number
      holdingLlcNew: number
      holdingLlcModify: number
      personalTaxReturn: number
      businessTaxReturnFederal: number
      businessTaxReturnState: number
    }
    salesTaxMonitoringMonthly: number
  }
}

export interface PricingLineItem {
  label: string
  amount: number
  kind: 'monthly' | 'setup'
  note?: string
}

export interface PricingCalculatorResult {
  tier: Tier
  tierLabel: string
  isEnterprise: boolean
  monthlyItems: PricingLineItem[]
  /** Up-front yearly pre-pay lines, separated for display clarity. */
  yearlyItems: PricingLineItem[]
  /** Setup/one-time lines excluding yearly pre-pay display lines. */
  setupDisplayItems: PricingLineItem[]
  setupItems: PricingLineItem[]
  monthlyTotal: number
  yearlyTotal: number
  setupDisplayTotal: number
  /** Up-front total charged today for setup, one-time, and yearly pre-pay lines. */
  setupTotal: number
  hasAnySelection: boolean
}

export interface PricingCheckoutAmountSummary {
  monthlyItems: PricingLineItem[]
  setupItems: PricingLineItem[]
  monthlyTotal: number
  setupTotal: number
}

export const MAX_CHECKOUT_LINE_AMOUNT = 999_999

export function detectPricingTier(nec1099Count: number): Tier {
  if (nec1099Count <= TIER_BASIC.maxNec1099) return 'basic'
  if (nec1099Count <= TIER_PRO.maxNec1099) return 'pro'
  return 'enterprise'
}

export function calculatePricing(input: PricingCalculatorInput): PricingCalculatorResult {
  const tier = detectPricingTier(input.nec1099Count)
  const tierDef =
    tier === 'basic'
      ? TIER_BASIC
      : tier === 'pro'
        ? TIER_PRO
        : { ...TIER_PRO, label: TIER_ENTERPRISE.marketingLabel }
  const monthly: PricingLineItem[] = []
  const setup: PricingLineItem[] = []
  const tierMonthly =
    tier === 'basic'
      ? input.rates.tiers.basicMonthly
      : tier === 'pro'
        ? input.rates.tiers.proMonthly
        : input.rates.tiers.vipMonthly

  monthly.push({ label: `${tierDef.label} tier`, amount: tierMonthly, kind: 'monthly' })
  setup.push({ label: `${tierDef.label} bookkeeping setup`, amount: tierDef.setup, kind: 'setup' })

  if (input.payrollEmployees > 0) {
    const perEmployee =
      input.payrollMode === 'ella-staff' ? PAYROLL.ellaStaffPerEmp : PAYROLL.ownerManualPerEmp
    monthly.push({
      label: 'Payroll base',
      amount: input.rates.payroll.baseMonthly,
      kind: 'monthly',
    })
    setup.push({ label: 'Payroll setup', amount: PAYROLL.baseSetup, kind: 'setup' })
    monthly.push({
      label: `Payroll employees (${input.payrollEmployees} × $${perEmployee}, ${input.payrollMode})`,
      amount: perEmployee * input.payrollEmployees,
      kind: 'monthly',
    })
  }

  if (input.cashPlan.enabled) {
    const rates = input.rates.cashPlan
    const cashMonthly =
      rates.perEmployeeMonthly * input.cashPlan.employees +
      rates.perOwnerMonthly * input.cashPlan.owners
    monthly.push({
      label: `Cash Plan (${input.cashPlan.employees} emp × $${rates.perEmployeeMonthly} + ${input.cashPlan.owners} owner × $${rates.perOwnerMonthly})`,
      amount: cashMonthly,
      kind: 'monthly',
    })
    setup.push({ label: 'Cash Plan setup', amount: rates.setup, kind: 'setup' })
  }

  if (input.auditProtection) {
    monthly.push({
      label: 'Audit Protection',
      amount: input.rates.auditProtection.monthly,
      kind: 'monthly',
    })
    setup.push({
      label: 'Audit Protection setup',
      amount: input.rates.auditProtection.setup,
      kind: 'setup',
    })
  }

  for (const key of Object.keys(ONE_TIME_LABELS) as Array<
    keyof PricingCalculatorInput['oneTime']
  >) {
    const quantity = input.oneTime[key]
    if (quantity <= 0) continue

    const unit =
      key === 'businessTaxReturn'
        ? input.rates.oneTime.businessTaxReturnFederal + input.rates.oneTime.businessTaxReturnState
        : input.rates.oneTime[key]
    setup.push({
      label: quantity > 1 ? `${ONE_TIME_LABELS[key]} × ${quantity}` : ONE_TIME_LABELS[key],
      amount: unit * quantity,
      kind: 'setup',
      note: key === 'startLlc' ? 'Excludes state filing fee' : undefined,
    })
  }

  if (input.salesTaxShops > 0) {
    monthly.push({
      label: `Sales tax monitoring (${input.salesTaxShops} shop${input.salesTaxShops > 1 ? 's' : ''})`,
      amount: input.rates.salesTaxMonitoringMonthly * input.salesTaxShops,
      kind: 'monthly',
    })
  }

  const monthlyTotal = total(monthly)
  const yearlyItems = setup.filter(isBusinessTaxReturnPrepayLine)
  const setupDisplayItems = setup.filter((item) => !isBusinessTaxReturnPrepayLine(item))
  const yearlyTotal = total(yearlyItems)
  const setupDisplayTotal = total(setupDisplayItems)
  const setupTotal = total(setup)

  return {
    tier,
    tierLabel: tierDef.label,
    isEnterprise: tier === 'enterprise',
    monthlyItems: monthly,
    yearlyItems,
    setupDisplayItems,
    setupItems: setup,
    monthlyTotal,
    yearlyTotal,
    setupDisplayTotal,
    setupTotal,
    hasAnySelection: monthly.length > 1 || setup.length > 1,
  }
}

export function isBusinessTaxReturnPrepayLine(item: Pick<PricingLineItem, 'label'>): boolean {
  return (
    item.label === BUSINESS_TAX_RETURN_PREPAY_LABEL ||
    item.label.startsWith(`${BUSINESS_TAX_RETURN_PREPAY_LABEL} × `)
  )
}

export function isPricingInputSane(input: PricingCalculatorInput): boolean {
  return (
    input.nec1099Count <= 200 &&
    input.payrollEmployees <= 200 &&
    input.cashPlan.employees <= 200 &&
    input.cashPlan.owners <= 99 &&
    input.salesTaxShops <= 200 &&
    Object.values(input.oneTime).every((quantity) => quantity <= 99)
  )
}

export function isPricingCheckoutAmountSane(result: PricingCheckoutAmountSummary): boolean {
  const lines = [...result.monthlyItems, ...result.setupItems]
  return (
    result.monthlyTotal <= MAX_CHECKOUT_LINE_AMOUNT &&
    result.setupTotal <= MAX_CHECKOUT_LINE_AMOUNT &&
    lines.every((item) => item.amount <= MAX_CHECKOUT_LINE_AMOUNT)
  )
}

function total(items: PricingLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}
