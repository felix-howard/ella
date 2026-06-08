/**
 * Pure presentation helpers for coupon rows in the management panel.
 * Discount/duration summaries mirror how Stripe will describe the coupon.
 */
import type { CouponSummary } from '../../../../lib/api-client'
import { formatCents } from '../custom-link-types'

/** "10% off" / "$100.00 off" — empty string if the row is malformed. */
export function discountSummary(coupon: CouponSummary): string {
  if (coupon.discountType === 'percent' && coupon.percentOff != null) {
    return `${coupon.percentOff}% off`
  }
  if (coupon.discountType === 'amount' && coupon.amountOffCents != null) {
    return `${formatCents(coupon.amountOffCents)} off`
  }
  return ''
}

/** "Once" / "Forever" / "3 months" describing how long the discount applies. */
export function durationSummary(coupon: CouponSummary): string {
  switch (coupon.duration) {
    case 'once':
      return 'Once'
    case 'forever':
      return 'Forever'
    case 'repeating':
      return coupon.durationInMonths != null ? `${coupon.durationInMonths} months` : 'Repeating'
  }
}

/** "3 / 100" or "3" when there's no cap. */
export function redemptionSummary(coupon: CouponSummary): string {
  return coupon.maxRedemptions != null
    ? `${coupon.timesRedeemed} / ${coupon.maxRedemptions}`
    : String(coupon.timesRedeemed)
}

/** Localized expiry date (e.g. "Jun 30, 2026"), or null when open-ended. */
export function expirySummary(coupon: CouponSummary): string | null {
  if (!coupon.redeemBy) return null
  const date = new Date(coupon.redeemBy)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
