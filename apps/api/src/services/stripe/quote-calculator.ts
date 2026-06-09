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
import {
  calculatePricing,
  isPricingCheckoutAmountSane,
  isPricingInputSane,
  type PricingLineItem,
} from '@ella/shared/pricing'

export type LineKind = 'monthly' | 'setup'

export interface QuoteLine {
  label: string
  /** Free-form detail (custom links only); calculator lines omit it. */
  description?: string
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
  const result = calculatePricing(input)
  const hasMeaningfulSelection = result.hasAnySelection || input.nec1099Count > 0

  if (!hasMeaningfulSelection) {
    throw new CheckoutQuoteError('Select at least one billable service before checkout')
  }

  if (result.isEnterprise) {
    throw new CheckoutQuoteError('Enterprise quotes require manual follow-up')
  }

  if (!isPricingInputSane(input)) {
    throw new CheckoutQuoteError('Quantity limits exceeded. Use manual follow-up')
  }

  if (result.monthlyTotal <= 0 && result.setupTotal <= 0) {
    throw new CheckoutQuoteError('Payable total is required')
  }

  const quote = {
    quoteId: `quote_${nanoid(16)}`,
    monthlyItems: toQuoteLines(result.monthlyItems),
    setupItems: toQuoteLines(result.setupItems),
    monthlyTotal: result.monthlyTotal,
    setupTotal: result.setupTotal,
  }

  if (!isPricingCheckoutAmountSane(quote)) {
    throw new CheckoutQuoteError('Quote total is too large for checkout')
  }

  return quote
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

function toQuoteLines(items: PricingLineItem[]): QuoteLine[] {
  return items.map(({ label, amount, kind }) => ({ label, amount, kind }))
}
