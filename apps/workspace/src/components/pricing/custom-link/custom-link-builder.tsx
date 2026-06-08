import { useMemo, useState } from 'react'
import { CustomLinkItemRows } from './custom-link-item-rows'
import { CustomLinkSummary } from './custom-link-summary'
import { CustomLinkActions } from './custom-link-actions'
import { CouponManagerPanel } from './coupons/coupon-manager-panel'
import { useActiveCoupons } from './use-active-coupons'
import {
  computeTotalCents,
  createEmptyItem,
  draftsToApiItems,
  isItemValid,
  type CustomBillingInterval,
  type CustomDiscountMode,
  type CustomItemDraft,
  type CustomLinkCorePayload,
} from './custom-link-types'

/**
 * Container for the free-form payment-link builder. Owns the line items,
 * interval, and discount choice; assembles the shared core payload and the
 * "create disabled" reason, then delegates create/send to {@link CustomLinkActions}.
 */
export function CustomLinkBuilder() {
  const [items, setItems] = useState<CustomItemDraft[]>(() => [createEmptyItem()])
  const [interval, setInterval] = useState<CustomBillingInterval>('one_time')
  const [discountMode, setDiscountMode] = useState<CustomDiscountMode>('none')
  const [couponId, setCouponId] = useState('')

  // Coupons are only needed once the user opts into pre-applying one.
  const { coupons, loading: couponsLoading } = useActiveCoupons(discountMode === 'coupon')

  const totalCents = useMemo(() => computeTotalCents(items), [items])
  const validItemCount = useMemo(() => items.filter(isItemValid).length, [items])

  const corePayload = useMemo<CustomLinkCorePayload | null>(() => {
    const apiItems = draftsToApiItems(items)
    if (!apiItems || apiItems.length === 0) return null
    if (discountMode === 'coupon' && !couponId) return null
    return {
      billingInterval: interval,
      items: apiItems,
      ...(discountMode === 'coupon' && couponId ? { couponId } : {}),
      ...(discountMode === 'promo' ? { allowPromotionCodes: true } : {}),
    }
  }, [items, interval, discountMode, couponId])

  const disabledReason = getDisabledReason(items, discountMode, couponId)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <CustomLinkItemRows items={items} disabled={false} onChange={setItems} />
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <CustomLinkSummary
            interval={interval}
            onIntervalChange={setInterval}
            totalCents={totalCents}
            validItemCount={validItemCount}
            discountMode={discountMode}
            onDiscountModeChange={(mode) => {
              setDiscountMode(mode)
              if (mode !== 'coupon') setCouponId('')
            }}
            couponId={couponId}
            onCouponIdChange={setCouponId}
            coupons={coupons}
            couponsLoading={couponsLoading}
          />
          <CustomLinkActions corePayload={corePayload} disabledReason={disabledReason} />
        </aside>
      </div>
      <CouponManagerPanel />
    </div>
  )
}

function getDisabledReason(
  items: CustomItemDraft[],
  discountMode: CustomDiscountMode,
  couponId: string
): string | null {
  const validItems = items.filter(isItemValid)
  if (validItems.length === 0) return 'Add at least one item with a name, amount, and quantity.'
  if (items.some((item) => !isItemValid(item))) return 'Fix or remove the incomplete item rows.'
  if (discountMode === 'coupon' && !couponId) return 'Select a coupon or choose a different discount option.'
  return null
}
