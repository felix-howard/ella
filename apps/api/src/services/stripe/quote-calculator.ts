import { nanoid } from 'nanoid'
import type { CheckoutPricingInput } from '../../routes/billing/schemas'
import {
  AUDIT_PROTECTION,
  CASH_PLAN,
  ONE_TIME,
  PAYROLL,
  SALES_TAX_MONITORING_MONTHLY,
  TIER_BASIC,
  TIER_PRO,
} from '@ella/shared/constants'

export type LineKind = 'monthly' | 'setup'

export interface QuoteLine {
  label: string
  amount: number
  kind: LineKind
}

export interface CheckoutQuote {
  quoteId: string
  monthlyItems: QuoteLine[]
  setupItems: QuoteLine[]
  monthlyTotal: number
  setupTotal: number
}

export class CheckoutQuoteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutQuoteError'
  }
}

export function calculateCheckoutQuote(input: CheckoutPricingInput): CheckoutQuote {
  assertMinimumRates(input)
  if (input.nec1099Count > TIER_PRO.maxNec1099) {
    throw new CheckoutQuoteError('Enterprise quotes require manual follow-up')
  }

  const monthlyItems: QuoteLine[] = []
  const setupItems: QuoteLine[] = []
  const tierLabel =
    input.nec1099Count <= TIER_BASIC.maxNec1099
      ? TIER_BASIC.label
      : input.nec1099Count <= TIER_PRO.maxNec1099
        ? TIER_PRO.label
        : 'VIP'
  const tierMonthly =
    tierLabel === 'Basic'
      ? input.rates.tiers.basicMonthly
      : tierLabel === 'Pro'
        ? input.rates.tiers.proMonthly
        : input.rates.tiers.vipMonthly

  monthlyItems.push({ label: `${tierLabel} tier`, amount: tierMonthly, kind: 'monthly' })
  setupItems.push({
    label: `${tierLabel} bookkeeping setup`,
    amount: TIER_BASIC.setup,
    kind: 'setup',
  })

  addPayrollItems(input, monthlyItems, setupItems)
  addCashPlanItems(input, monthlyItems, setupItems)
  addAuditProtectionItems(input, monthlyItems, setupItems)
  addOneTimeItems(input, setupItems)
  addSalesTaxItems(input, monthlyItems)

  const monthlyTotal = total(monthlyItems)
  const setupTotal = total(setupItems)
  if (monthlyTotal <= 0 && setupTotal <= 0) {
    throw new CheckoutQuoteError('Payable total is required')
  }

  return {
    quoteId: `quote_${nanoid(16)}`,
    monthlyItems,
    setupItems,
    monthlyTotal,
    setupTotal,
  }
}

function addPayrollItems(
  input: CheckoutPricingInput,
  monthlyItems: QuoteLine[],
  setupItems: QuoteLine[]
): void {
  if (input.payrollEmployees <= 0) return

  const perEmployee =
    input.payrollMode === 'ella-staff' ? PAYROLL.ellaStaffPerEmp : PAYROLL.ownerManualPerEmp
  monthlyItems.push({
    label: 'Payroll base',
    amount: input.rates.payroll.baseMonthly,
    kind: 'monthly',
  })
  monthlyItems.push({
    label: `Payroll employees (${input.payrollEmployees})`,
    amount: perEmployee * input.payrollEmployees,
    kind: 'monthly',
  })
  setupItems.push({ label: 'Payroll setup', amount: PAYROLL.baseSetup, kind: 'setup' })
}

function addCashPlanItems(
  input: CheckoutPricingInput,
  monthlyItems: QuoteLine[],
  setupItems: QuoteLine[]
): void {
  if (!input.cashPlan.enabled) return

  monthlyItems.push({
    label: 'Cash Plan',
    amount:
      input.rates.cashPlan.perEmployeeMonthly * input.cashPlan.employees +
      input.rates.cashPlan.perOwnerMonthly * input.cashPlan.owners,
    kind: 'monthly',
  })
  setupItems.push({ label: 'Cash Plan setup', amount: input.rates.cashPlan.setup, kind: 'setup' })
}

function addAuditProtectionItems(
  input: CheckoutPricingInput,
  monthlyItems: QuoteLine[],
  setupItems: QuoteLine[]
): void {
  if (!input.auditProtection) return

  monthlyItems.push({
    label: 'Audit Protection',
    amount: input.rates.auditProtection.monthly,
    kind: 'monthly',
  })
  setupItems.push({
    label: 'Audit Protection setup',
    amount: input.rates.auditProtection.setup,
    kind: 'setup',
  })
}

function addOneTimeItems(input: CheckoutPricingInput, setupItems: QuoteLine[]): void {
  const oneTime = input.oneTime
  const rates = input.rates.oneTime
  const businessReturnRate = rates.businessTaxReturnFederal + rates.businessTaxReturnState
  const units = [
    ['Start LLC', oneTime.startLlc, rates.startLlc],
    ['Holding LLC (new)', oneTime.holdingLlcNew, rates.holdingLlcNew],
    ['Re-structure LLC basic', oneTime.holdingLlcModify, rates.holdingLlcModify],
    ['Personal tax return', oneTime.personalTaxReturn, rates.personalTaxReturn],
    ['Business tax return', oneTime.businessTaxReturn, businessReturnRate],
  ] as const

  for (const [label, quantity, rate] of units) {
    if (quantity > 0) setupItems.push({ label, amount: quantity * rate, kind: 'setup' })
  }
}

function addSalesTaxItems(input: CheckoutPricingInput, monthlyItems: QuoteLine[]): void {
  if (input.salesTaxShops <= 0) return

  monthlyItems.push({
    label: `Sales tax monitoring (${input.salesTaxShops})`,
    amount: input.rates.salesTaxMonitoringMonthly * input.salesTaxShops,
    kind: 'monthly',
  })
}

function assertMinimumRates(input: CheckoutPricingInput): void {
  const checks = [
    [input.rates.tiers.basicMonthly, TIER_BASIC.monthly],
    [input.rates.tiers.proMonthly, TIER_PRO.monthly],
    [input.rates.tiers.vipMonthly, TIER_PRO.monthly],
    [input.rates.payroll.baseMonthly, PAYROLL.baseMonthly],
    [input.rates.cashPlan.setup, CASH_PLAN.setup],
    [input.rates.cashPlan.perEmployeeMonthly, CASH_PLAN.perEmployeeMonthly],
    [input.rates.cashPlan.perOwnerMonthly, CASH_PLAN.perOwnerMonthly],
    [input.rates.auditProtection.monthly, AUDIT_PROTECTION.monthly],
    [input.rates.auditProtection.setup, AUDIT_PROTECTION.setup],
    [input.rates.oneTime.startLlc, ONE_TIME.startLlc],
    [input.rates.oneTime.holdingLlcNew, ONE_TIME.holdingLlcNew],
    [input.rates.oneTime.holdingLlcModify, ONE_TIME.holdingLlcModify],
    [input.rates.oneTime.personalTaxReturn, ONE_TIME.personalTaxReturn],
    [input.rates.oneTime.businessTaxReturnFederal, ONE_TIME.businessTaxReturnFederal],
    [input.rates.oneTime.businessTaxReturnState, ONE_TIME.businessTaxReturnState],
    [input.rates.salesTaxMonitoringMonthly, SALES_TAX_MONITORING_MONTHLY],
  ] as const

  if (checks.some(([actual, minimum]) => actual < minimum)) {
    throw new CheckoutQuoteError('Rate overrides below current defaults are not allowed')
  }
}

function total(items: QuoteLine[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}
