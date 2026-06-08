/**
 * Source-aware rebuild of the line items a checkout session should charge.
 *
 * Calculator quotes are drift-safe by recomputation: the frozen `pricingInput`
 * is re-run through `calculateCheckoutQuote` (rate-validated, deterministic).
 * Custom quotes have no `pricingInput` — their normalized `lineItems` were frozen
 * into `resultSnapshot` at create/send time and ARE the source of truth, so we
 * read them straight back (no recompute) after re-validating their shape.
 */
import { z } from 'zod'
import { calculateCheckoutQuote } from './quote-calculator'
import { toCheckoutLineItems, type CheckoutLineItem } from './checkout-line-items'
import { checkoutPricingInputSchema } from '../../routes/billing/schemas'
import { getActiveCouponById } from '../coupons/coupon-service'

/** Minimal PaymentQuote shape the rebuild needs (decoupled from the Prisma model). */
export interface RebuildableQuote {
  source: string
  inputSnapshot: unknown
  resultSnapshot: unknown
  appliedCouponId: string | null
  allowPromotionCodes: boolean
  organizationId: string | null
}

const storedLineItemSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  unitAmountCents: z.number().int().positive(),
  quantity: z.number().int().positive(),
  interval: z.enum(['one_time', 'month', 'year']),
})
const storedLineItemsSchema = z.array(storedLineItemSchema).min(1)

export function rebuildQuoteForCheckout(quote: RebuildableQuote): CheckoutLineItem[] {
  if (quote.source === 'custom') {
    const snapshot = quote.resultSnapshot
    const raw =
      snapshot && typeof snapshot === 'object'
        ? (snapshot as { lineItems?: unknown }).lineItems
        : undefined
    return storedLineItemsSchema.parse(raw)
  }

  const pricingInput = parsePricingInput(quote.inputSnapshot)
  return toCheckoutLineItems(calculateCheckoutQuote(pricingInput))
}

function parsePricingInput(snapshot: unknown) {
  const raw =
    snapshot && typeof snapshot === 'object'
      ? (snapshot as { pricingInput?: unknown }).pricingInput
      : undefined
  return checkoutPricingInputSchema.parse(raw)
}

/** Coupon options for a checkout session, honoring the coupon-XOR-promo rule. */
export interface CouponSessionOptions {
  stripeCouponId?: string
  allowPromotionCodes?: boolean
}

/**
 * Resolve the coupon attach options for a stored quote. A pre-applied coupon
 * (active + synced to Stripe) wins; otherwise promo codes are offered if the
 * quote was created with that flag. Never returns both.
 *
 * Fail-open policy: if a pre-applied coupon was since disabled/unsynced,
 * `getActiveCouponById` returns null and we fall through to full price rather
 * than block the client's payment. The create/send flows validate the coupon up
 * front and reject a bad id; this resolver runs later, at portal checkout, where
 * letting the client pay full price beats failing the checkout outright.
 */
export async function resolveQuoteCouponOptions(
  quote: RebuildableQuote
): Promise<CouponSessionOptions> {
  if (quote.appliedCouponId && quote.organizationId) {
    const coupon = await getActiveCouponById(quote.appliedCouponId, quote.organizationId)
    if (coupon?.stripeCouponId) return { stripeCouponId: coupon.stripeCouponId }
  }
  if (quote.allowPromotionCodes) return { allowPromotionCodes: true }
  return {}
}
