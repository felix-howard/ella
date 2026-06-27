import { nanoid } from 'nanoid'
import { isPricingCheckoutAmountSane } from '@ella/shared/pricing'
import { CheckoutQuoteError } from './quote-calculator'
import type { CheckoutQuote, LineKind, QuoteLine } from './quote-calculator'
import {
  customItemsToLineItems,
  normalizeLineItemDescription,
  normalizeLineItemLabel,
  type CheckoutInterval,
  type CheckoutLineItem,
  type CustomLineItemInput,
} from './checkout-line-items'

/** Coarse per-item ceiling ($1,000,000 in cents); the checkout sanity ceiling is stricter. */
const MAX_UNIT_AMOUNT_CENTS = 1_000_000_00
const MAX_QUANTITY = 1000
const MAX_LABEL_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 500

/**
 * Free-form custom payment link input.
 *
 * v1 scope: a link is EITHER fully one-time (`billingInterval: 'one_time'`) OR
 * recurring (`'month' | 'year'`) with optional one-time add-on items. This mirrors
 * the calculator's monthly+setup shape, so existing persistence/webhook math holds.
 */
export interface CustomQuoteInput {
  billingInterval: CheckoutInterval
  /** Primary items. Recurring when interval is recurring; one-time when interval is `one_time`. */
  items: CustomLineItemInput[]
  /** Optional one-time add-on items (only meaningful for recurring links). */
  oneTimeItems?: CustomLineItemInput[]
}

export interface CustomQuoteResult {
  quote: CheckoutQuote
  lineItems: CheckoutLineItem[]
  billingInterval: CheckoutInterval
}

/**
 * Validate free-form input and freeze it into a `CheckoutQuote`-compatible object.
 *
 * Custom quotes have no `pricingInput` — the returned `quote` + `lineItems` ARE the
 * frozen source that Phase 3 stores and rebuilds from (no recompute). Totals are in
 * dollars to match the existing `*100` persistence contract.
 */
export function buildCustomQuote(input: CustomQuoteInput): CustomQuoteResult {
  const isRecurring = input.billingInterval === 'month' || input.billingInterval === 'year'

  // When the link is one-time, every primary item is one-time; add-ons only apply to recurring links.
  const recurringItems = isRecurring ? input.items : []
  const oneTimeItems = isRecurring ? (input.oneTimeItems ?? []) : input.items

  const allItems = [...recurringItems, ...oneTimeItems]
  if (allItems.length === 0) {
    throw new CheckoutQuoteError('At least one line item is required')
  }
  allItems.forEach(validateItem)

  const quote: CheckoutQuote = {
    quoteId: `quote_${nanoid(16)}`,
    monthlyItems: toQuoteLines(recurringItems, 'monthly'),
    setupItems: toQuoteLines(oneTimeItems, 'setup'),
    monthlyTotal: sumDollars(recurringItems),
    setupTotal: sumDollars(oneTimeItems),
  }

  if (!isPricingCheckoutAmountSane(quote)) {
    throw new CheckoutQuoteError('Quote total is too large for checkout')
  }

  const lineItems = [
    ...customItemsToLineItems(recurringItems, input.billingInterval),
    ...customItemsToLineItems(oneTimeItems, 'one_time'),
  ]

  return { quote, lineItems, billingInterval: input.billingInterval }
}

function validateItem(item: CustomLineItemInput): void {
  const label = normalizeLineItemLabel(item.label ?? '')
  if (label.length < 1 || label.length > MAX_LABEL_LENGTH) {
    throw new CheckoutQuoteError(`Line item label must be 1-${MAX_LABEL_LENGTH} characters`)
  }

  const description = normalizeLineItemDescription(item.description)
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new CheckoutQuoteError(
      `Line item description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`
    )
  }

  if (
    !Number.isInteger(item.unitAmountCents) ||
    item.unitAmountCents <= 0 ||
    item.unitAmountCents > MAX_UNIT_AMOUNT_CENTS
  ) {
    throw new CheckoutQuoteError('Line item amount must be between 1 cent and $1,000,000')
  }

  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
    throw new CheckoutQuoteError(`Line item quantity must be between 1 and ${MAX_QUANTITY}`)
  }
}

function toQuoteLines(items: CustomLineItemInput[], kind: LineKind): QuoteLine[] {
  return items.map((item) => {
    const description = normalizeLineItemDescription(item.description)
    return {
      label: normalizeLineItemLabel(item.label),
      // Surfaced on the portal pay page; omit when blank so calculator parity holds.
      ...(description ? { description } : {}),
      amount: (item.unitAmountCents * item.quantity) / 100,
      kind,
    }
  })
}

/** Sum line totals in dollars; sum integer cents first to avoid float drift. */
function sumDollars(items: CustomLineItemInput[]): number {
  const cents = items.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0)
  return cents / 100
}
