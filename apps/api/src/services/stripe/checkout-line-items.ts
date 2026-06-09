import type { CheckoutQuote } from './quote-calculator'

/**
 * Normalized line-item abstraction shared by both quote sources.
 * Calculator quotes resolve to the 2 aggregate lines the current builder emits;
 * custom quotes resolve to their free-form items. Phase 3's Stripe params builder
 * iterates this array instead of hardcoding "monthly + setup".
 */
export type CheckoutInterval = 'one_time' | 'month' | 'year'

export interface CheckoutLineItem {
  label: string
  description?: string
  /** Per-unit amount in cents (> 0). */
  unitAmountCents: number
  /** >= 1 */
  quantity: number
  interval: CheckoutInterval
}

/** Free-form item shape accepted from custom payment links (amount in cents). */
export interface CustomLineItemInput {
  label: string
  description?: string
  unitAmountCents: number
  quantity: number
}

/** Labels for the calculator's 2 aggregate Stripe lines (canonical source). */
export const CALCULATOR_MONTHLY_LABEL = 'Ella monthly service'
export const CALCULATOR_SETUP_LABEL = 'Ella setup and one-time services'

/**
 * Calculator quote → normalized line items.
 *
 * Reproduces current calculator checkout behaviour EXACTLY: a single aggregate
 * monthly line (`monthlyTotal`) and a single aggregate one-time line
 * (`setupTotal`). Itemizing here would change the Stripe session shape, so the
 * per-item arrays are intentionally collapsed to the 2 canonical lines.
 */
export function toCheckoutLineItems(quote: CheckoutQuote): CheckoutLineItem[] {
  const items: CheckoutLineItem[] = []

  if (quote.monthlyTotal > 0) {
    items.push({
      label: CALCULATOR_MONTHLY_LABEL,
      unitAmountCents: Math.round(quote.monthlyTotal * 100),
      quantity: 1,
      interval: 'month',
    })
  }

  if (quote.setupTotal > 0) {
    items.push({
      label: CALCULATOR_SETUP_LABEL,
      unitAmountCents: Math.round(quote.setupTotal * 100),
      quantity: 1,
      interval: 'one_time',
    })
  }

  return items
}

/** Custom free-form items → normalized line items at a fixed interval. */
export function customItemsToLineItems(
  items: CustomLineItemInput[],
  interval: CheckoutInterval
): CheckoutLineItem[] {
  return items.map((item) => ({
    label: item.label.trim(),
    description: item.description?.trim() || undefined,
    unitAmountCents: item.unitAmountCents,
    quantity: item.quantity,
    interval,
  }))
}
