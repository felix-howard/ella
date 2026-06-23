import {
  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY,
  MAX_CALCULATOR_CUSTOM_LABEL_LENGTH,
  type PricingCalculatorCustomBillingInterval,
  type PricingCalculatorInput,
  type PricingCalculatorCustomItem,
} from '@ella/shared/pricing'

export const CALCULATOR_CUSTOM_BILLING_OPTIONS: Array<{
  value: PricingCalculatorCustomBillingInterval
  label: string
}> = [
  { value: 'one_time', label: 'One-time' },
  { value: 'month', label: 'Monthly' },
]

let customItemSeq = 0

interface CustomItemDraftState {
  amountDraft: string
  quantityDraft: string
}

export function createPricingCalculatorCustomItem(): PricingCalculatorCustomItem {
  return {
    id: createCustomItemId(),
    label: '',
    amount: 0,
    quantity: 1,
    billingInterval: 'one_time',
  }
}

export function getPricingCalculatorCustomItemValidation(
  item: PricingCalculatorCustomItem,
  draft: CustomItemDraftState
): string[] {
  const messages: string[] = []
  if (item.label.trim().length === 0) messages.push('Enter an item name.')
  if (item.label.trim().length > MAX_CALCULATOR_CUSTOM_LABEL_LENGTH) {
    messages.push(`Keep item name under ${MAX_CALCULATOR_CUSTOM_LABEL_LENGTH} characters.`)
  }
  const amountError = getPricingCalculatorCustomAmountDraftError(draft.amountDraft)
  const quantityError = getPricingCalculatorCustomQuantityDraftError(draft.quantityDraft)
  if (amountError) messages.push(amountError)
  if (quantityError) messages.push(quantityError)
  if (!isPricingCalculatorCustomBillingInterval(item.billingInterval)) {
    messages.push('Choose one-time or monthly billing.')
  }
  return messages
}

export function getPricingCalculatorCustomItemLineTotal(
  item: PricingCalculatorCustomItem,
  draft: CustomItemDraftState
): number | null {
  if (getPricingCalculatorCustomItemValidation(item, draft).length > 0) return null
  const amount = parsePricingCalculatorCustomWholeNumber(draft.amountDraft)
  const quantity = parsePricingCalculatorCustomWholeNumber(draft.quantityDraft)
  if (amount === null || quantity === null) return null
  return amount * quantity
}

export function getPricingCalculatorCustomAmountDraftError(value: string): string | null {
  return getWholeNumberDraftError(value, {
    empty: 'Enter an amount of at least $1.',
    invalid: 'Enter a whole-dollar amount.',
    tooSmall: 'Enter an amount of at least $1.',
    tooLarge: `Amount must be ${MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT.toLocaleString()} or less.`,
    max: MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  })
}

export function getPricingCalculatorCustomQuantityDraftError(value: string): string | null {
  return getWholeNumberDraftError(value, {
    empty: 'Enter quantity of at least 1.',
    invalid: 'Enter a whole-number quantity.',
    tooSmall: 'Enter quantity of at least 1.',
    tooLarge: `Quantity must be ${MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY} or less.`,
    max: MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY,
  })
}

export function toPricingCalculatorCustomDraftNumber(value: string, max: number): number {
  const parsed = parsePricingCalculatorCustomWholeNumber(value)
  if (parsed === null || parsed < 1 || parsed > max) return 0
  return parsed
}

export function hasInvalidPricingCalculatorCustomItems(input: PricingCalculatorInput): boolean {
  if (!Array.isArray(input.customItems)) return false
  return input.customItems.some((item) => !isValidPricingCalculatorCustomItem(item))
}

export function getCalculatorCustomItemsError(input: PricingCalculatorInput): string | null {
  return hasInvalidPricingCalculatorCustomItems(input)
    ? 'Finish or remove incomplete custom item rows.'
    : null
}

export function hasCompletePricingCalculatorCustomItems(input: PricingCalculatorInput): boolean {
  if (!Array.isArray(input.customItems)) return false
  return input.customItems.some(isValidPricingCalculatorCustomItem)
}

function createCustomItemId(): string {
  customItemSeq += 1
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `custom-item-${customItemSeq}`
}

function getWholeNumberDraftError(
  value: string,
  messages: {
    empty: string
    invalid: string
    tooSmall: string
    tooLarge: string
    max: number
  }
): string | null {
  const parsed = parsePricingCalculatorCustomWholeNumber(value)
  if (value.trim().length === 0) return messages.empty
  if (parsed === null) return messages.invalid
  if (parsed < 1) return messages.tooSmall
  if (parsed > messages.max) return messages.tooLarge
  return null
}

function parsePricingCalculatorCustomWholeNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function isPricingCalculatorCustomBillingInterval(
  value: string
): value is PricingCalculatorCustomBillingInterval {
  return value === 'one_time' || value === 'month'
}

function isValidPricingCalculatorCustomItem(item: PricingCalculatorCustomItem): boolean {
  const candidate = item as Partial<PricingCalculatorCustomItem>
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  const amount = candidate.amount
  const quantity = candidate.quantity
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    label.length > 0 &&
    label.length <= MAX_CALCULATOR_CUSTOM_LABEL_LENGTH &&
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT &&
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY &&
    typeof candidate.billingInterval === 'string' &&
    isPricingCalculatorCustomBillingInterval(candidate.billingInterval)
  )
}
