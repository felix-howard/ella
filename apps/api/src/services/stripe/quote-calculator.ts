import { nanoid } from 'nanoid'
import type { CheckoutPricingInput } from '../../routes/billing/schemas'
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

function toQuoteLines(items: PricingLineItem[]): QuoteLine[] {
  return items.map(({ label, amount, kind }) => ({ label, amount, kind }))
}
