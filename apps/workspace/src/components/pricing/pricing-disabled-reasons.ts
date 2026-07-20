import {
  findNonPositivePricingLine,
  isPricingCheckoutAmountSane,
  isPricingInputSane,
  type PricingCalculatorInput,
  type PricingCalculatorResult,
} from '@ella/shared/pricing'
import {
  getCalculatorCustomItemsError,
  hasCompletePricingCalculatorCustomItems,
} from './pricing-calculator-custom-items'

const CUSTOM_ONLY_CALCULATOR_REASON =
  'Use Custom link for custom-only charges, or select a standard calculator service.'
export const CASH_PLAN_PARTICIPANTS_REQUIRED_REASON =
  'Cash Plan requires at least 1 employee or owner. Enter a quantity or turn Cash Plan off.'

export function getCreateDisabledReason(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult
): string | null {
  const payableTotal = result.monthlyTotal + result.setupTotal
  const customItemsError = getCalculatorCustomItemsError(input)

  if (customItemsError) return customItemsError
  if (!hasMeaningfulSelection(input, result)) {
    if (hasCompletePricingCalculatorCustomItems(input)) return CUSTOM_ONLY_CALCULATOR_REASON
    return 'Select at least one billable service before creating a link.'
  }
  if (!isPricingInputSane(input)) {
    return 'Quantity limits exceeded. Reduce quantities before checkout.'
  }
  const nonPositiveLineReason = getNonPositiveLineReason(input, result)
  if (nonPositiveLineReason) return nonPositiveLineReason
  if (!isPricingCheckoutAmountSane(result)) {
    return 'Quote total is too large for checkout.'
  }
  if (payableTotal <= 0) return 'Payable total must be greater than $0.'
  return null
}

export function getPrintDisabledReason(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult
): string | null {
  const customItemsError = getCalculatorCustomItemsError(input)

  if (customItemsError) return customItemsError
  if (!isPricingInputSane(input)) {
    return 'Quantity limits exceeded. Reduce quantities before checkout.'
  }
  if (!hasMeaningfulSelection(input, result)) {
    if (hasCompletePricingCalculatorCustomItems(input)) return CUSTOM_ONLY_CALCULATOR_REASON
    return 'Select at least one billable service before printing a quote.'
  }
  const nonPositiveLineReason = getNonPositiveLineReason(input, result)
  if (nonPositiveLineReason) return nonPositiveLineReason
  return null
}

function getNonPositiveLineReason(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult
): string | null {
  if (input.cashPlan.enabled && input.cashPlan.employees + input.cashPlan.owners <= 0) {
    return CASH_PLAN_PARTICIPANTS_REQUIRED_REASON
  }

  const line = findNonPositivePricingLine(result)
  return line ? `Set a price above $0 for ${line.label}.` : null
}

function hasMeaningfulSelection(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult
): boolean {
  return result.hasAnySelection || input.nec1099Count > 0
}
