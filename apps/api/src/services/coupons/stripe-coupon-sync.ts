import type Stripe from 'stripe'
import { getStripeClient } from '../stripe/client'

/**
 * Thin wrapper over the Stripe Coupon + Promotion Code APIs. Stripe owns the
 * discount math, expiry, usage-limit and recurring duration; we only mirror the
 * intent here so the app row can store the resulting Stripe IDs.
 */

export interface StripeCouponInput {
  discountType: 'percent' | 'amount'
  percentOff?: number
  amountOffCents?: number
  currency: string
  duration: 'once' | 'forever' | 'repeating'
  durationInMonths?: number
  maxRedemptions?: number
  redeemBy?: Date
  name?: string
}

export async function createStripeCoupon(input: StripeCouponInput): Promise<Stripe.Coupon> {
  const params: Stripe.CouponCreateParams = {
    duration: input.duration,
    ...(input.name ? { name: input.name } : {}),
    ...(input.discountType === 'percent'
      ? { percent_off: input.percentOff }
      : { amount_off: input.amountOffCents, currency: input.currency }),
    ...(input.duration === 'repeating' ? { duration_in_months: input.durationInMonths } : {}),
    ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
    ...(input.redeemBy ? { redeem_by: Math.floor(input.redeemBy.getTime() / 1000) } : {}),
  }

  return getStripeClient().coupons.create(params)
}

export async function createStripePromotionCode(
  couponId: string,
  code: string
): Promise<Stripe.PromotionCode> {
  // Stripe v22 nests the coupon under `promotion` (replacing the flat `coupon` field).
  return getStripeClient().promotionCodes.create({
    code,
    promotion: { type: 'coupon', coupon: couponId },
  })
}

export async function deactivatePromotionCode(promotionCodeId: string): Promise<void> {
  await getStripeClient().promotionCodes.update(promotionCodeId, { active: false })
}

/** Best-effort cleanup when a later create step fails — never throws. */
export async function deleteStripeCoupon(couponId: string): Promise<void> {
  try {
    await getStripeClient().coupons.del(couponId)
  } catch (error) {
    console.warn('[coupons] failed to roll back Stripe coupon', couponId, error)
  }
}

/** Live redemption count for a coupon; callers refresh lazily, not on every list. */
export async function fetchRedemptionCount(couponId: string): Promise<number> {
  const coupon = await getStripeClient().coupons.retrieve(couponId)
  return coupon.times_redeemed ?? 0
}
