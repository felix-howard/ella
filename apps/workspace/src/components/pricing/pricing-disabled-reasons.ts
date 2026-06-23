import {
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
  if (result.isEnterprise) return 'VIP quotes require manual follow-up.'
  if (!isPricingInputSane(input)) return 'Quantity limits exceeded. Use manual follow-up.'
  if (!isPricingCheckoutAmountSane(result)) {
    return 'Quote total is too large for checkout. Use manual follow-up.'
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
  if (!isPricingInputSane(input)) return 'Quantity limits exceeded. Use manual follow-up.'
  if (result.isEnterprise) return 'VIP quotes require manual follow-up.'
  if (!hasMeaningfulSelection(input, result)) {
    if (hasCompletePricingCalculatorCustomItems(input)) return CUSTOM_ONLY_CALCULATOR_REASON
    return 'Select at least one billable service before printing a quote.'
  }
  return null
}

function hasMeaningfulSelection(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult
): boolean {
  return result.hasAnySelection || input.nec1099Count > 0
}
