/**
 * Types + pure helpers for the custom (free-form) payment-link builder.
 *
 * Drafts hold raw string inputs (what the user types); conversion to the
 * cents-based API shape happens only at submit time via `draftToApiItem`.
 * Limits mirror the API `customLineItemSchema` so the UI rejects bad rows
 * before a request is made.
 */
import type { CustomLineItemInput } from '../../../lib/api-client'

export type CustomBillingInterval = 'one_time' | 'month' | 'year'

/** Discount choice — mutually exclusive per Stripe checkout-session limits. */
export type CustomDiscountMode = 'none' | 'coupon' | 'promo'

/** A single editable row in the builder. `id` is a stable local key only. */
export interface CustomItemDraft {
  id: string
  label: string
  description: string
  /** Dollar amount as typed (e.g. "49.99"); converted to cents on submit. */
  amount: string
  /** Quantity as typed; converted to an integer on submit. */
  quantity: string
}

/** Items + interval + discount choice, assembled by the builder for both actions. */
export interface CustomLinkCorePayload {
  billingInterval: CustomBillingInterval
  items: CustomLineItemInput[]
  couponId?: string
  allowPromotionCodes?: boolean
}

export const MAX_CUSTOM_ITEMS = 50
export const MAX_UNIT_AMOUNT_CENTS = 1_000_000_00
export const MAX_QUANTITY = 1000

/**
 * Parse a dollar string into integer cents. Returns null when blank,
 * non-numeric, negative, or above the per-item cap.
 */
export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  const cents = Math.round(parsed * 100)
  if (cents < 1 || cents > MAX_UNIT_AMOUNT_CENTS) return null
  return cents
}

/** Parse a quantity string into a positive integer within bounds, else null. */
export function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_QUANTITY) return null
  return parsed
}

/** True when a row has a non-empty label, valid amount, and valid quantity. */
export function isItemValid(item: CustomItemDraft): boolean {
  return (
    item.label.trim().length > 0 &&
    dollarsToCents(item.amount) !== null &&
    parseQuantity(item.quantity) !== null
  )
}

/** Line subtotal in cents for a row, or null if the row is incomplete. */
export function rowLineCents(item: CustomItemDraft): number | null {
  const unit = dollarsToCents(item.amount)
  const qty = parseQuantity(item.quantity)
  if (unit === null || qty === null) return null
  return unit * qty
}

/** Sum of all valid rows' line subtotals (cents). Incomplete rows are skipped. */
export function computeTotalCents(items: CustomItemDraft[]): number {
  return items.reduce((sum, item) => sum + (rowLineCents(item) ?? 0), 0)
}

/** Convert a draft row to the API line-item shape, or null if invalid. */
export function draftToApiItem(item: CustomItemDraft): CustomLineItemInput | null {
  const unitAmountCents = dollarsToCents(item.amount)
  const quantity = parseQuantity(item.quantity)
  const label = item.label.trim()
  if (unitAmountCents === null || quantity === null || !label) return null
  const description = item.description.trim()
  return {
    label,
    quantity,
    unitAmountCents,
    ...(description ? { description } : {}),
  }
}

/** Convert all rows to API items, returning null if any valid row fails. */
export function draftsToApiItems(items: CustomItemDraft[]): CustomLineItemInput[] | null {
  const mapped = items.map(draftToApiItem)
  if (mapped.some((item) => item === null)) return null
  return mapped as CustomLineItemInput[]
}

const centsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format integer cents as a 2-decimal USD string (e.g. 4999 → "$49.99"). */
export function formatCents(cents: number): string {
  return centsFormatter.format(cents / 100)
}

let itemKeySeq = 0

/** Create a blank draft row with a unique local key. */
export function createEmptyItem(): CustomItemDraft {
  itemKeySeq += 1
  return { id: `item-${itemKeySeq}`, label: '', description: '', amount: '', quantity: '1' }
}
