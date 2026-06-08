import { Select } from '@ella/ui'
import type { CouponSummary } from '../../../lib/api-client'
import { formatCents, type CustomBillingInterval, type CustomDiscountMode } from './custom-link-types'

interface CustomLinkSummaryProps {
  interval: CustomBillingInterval
  onIntervalChange: (interval: CustomBillingInterval) => void
  totalCents: number
  validItemCount: number
  discountMode: CustomDiscountMode
  onDiscountModeChange: (mode: CustomDiscountMode) => void
  couponId: string
  onCouponIdChange: (couponId: string) => void
  coupons: CouponSummary[]
  couponsLoading: boolean
}

const INTERVAL_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

const DISCOUNT_OPTIONS = [
  { value: 'none', label: 'No discount' },
  { value: 'coupon', label: 'Pre-apply a coupon' },
  { value: 'promo', label: 'Let client enter a code' },
]

export function CustomLinkSummary({
  interval,
  onIntervalChange,
  totalCents,
  validItemCount,
  discountMode,
  onDiscountModeChange,
  couponId,
  onCouponIdChange,
  coupons,
  couponsLoading,
}: CustomLinkSummaryProps) {
  const isRecurring = interval !== 'one_time'
  const totalSuffix = interval === 'month' ? ' / mo' : interval === 'year' ? ' / yr' : ''

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="custom-summary-title">
      <header>
        <h2 id="custom-summary-title" className="text-sm font-semibold text-foreground">
          Billing & total
        </h2>
      </header>

      <div className="mt-4 space-y-3">
        <label htmlFor="custom-interval" className="block text-xs font-medium text-foreground">
          Billing interval
          <Select
            id="custom-interval"
            className="mt-1"
            options={INTERVAL_OPTIONS}
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value as CustomBillingInterval)}
          />
        </label>

        {isRecurring && (
          <p className="text-[11px] text-muted-foreground">
            Recurring link. One-time setup add-ons aren't supported on recurring links yet.
          </p>
        )}

        <label htmlFor="custom-discount-mode" className="block text-xs font-medium text-foreground">
          Discount
          <Select
            id="custom-discount-mode"
            className="mt-1"
            options={DISCOUNT_OPTIONS}
            value={discountMode}
            onChange={(e) => onDiscountModeChange(e.target.value as CustomDiscountMode)}
          />
        </label>

        {discountMode === 'coupon' && (
          <label htmlFor="custom-coupon" className="block text-xs font-medium text-foreground">
            Coupon
            <Select
              id="custom-coupon"
              className="mt-1"
              placeholder={couponsLoading ? 'Loading coupons…' : 'Select a coupon'}
              value={couponId}
              disabled={couponsLoading || coupons.length === 0}
              onChange={(e) => onCouponIdChange(e.target.value)}
              options={coupons.map((coupon) => ({
                value: coupon.id,
                label: couponLabel(coupon),
              }))}
            />
            {!couponsLoading && coupons.length === 0 && (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                No active coupons. Create one in Coupons first.
              </span>
            )}
          </label>
        )}

        {discountMode === 'promo' && (
          <p className="text-[11px] text-muted-foreground">
            The client can type any active promotion code on the Stripe checkout page.
          </p>
        )}

        <div className="flex items-baseline justify-between rounded-lg border border-primary-light bg-primary-light/30 px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            Total{validItemCount > 0 ? ` · ${validItemCount} item${validItemCount > 1 ? 's' : ''}` : ''}
          </span>
          <span className="text-lg font-semibold text-primary-dark">
            {formatCents(totalCents)}
            <span className="text-xs font-normal text-muted-foreground">{totalSuffix}</span>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">Discounts are applied by Stripe at checkout.</p>
      </div>
    </section>
  )
}

function couponLabel(coupon: CouponSummary): string {
  const discount =
    coupon.discountType === 'percent' && coupon.percentOff != null
      ? `${coupon.percentOff}% off`
      : coupon.amountOffCents != null
        ? `${formatCents(coupon.amountOffCents)} off`
        : ''
  const name = coupon.name?.trim()
  const base = name ? `${name} (${coupon.code})` : coupon.code
  return discount ? `${base} — ${discount}` : base
}
