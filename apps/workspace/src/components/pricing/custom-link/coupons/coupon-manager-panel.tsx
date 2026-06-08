import { useState } from 'react'
import { ChevronDown, Ticket } from 'lucide-react'
import { useCoupons } from './use-coupons'
import { CouponCreateForm } from './coupon-create-form'
import { CouponList } from './coupon-list'

/**
 * Collapsible "Discount codes" section for the Custom link tab. Bundles the
 * create form and the list of existing coupons. Defaults collapsed to keep the
 * builder uncluttered; the active count hints at what's available.
 */
export function CouponManagerPanel() {
  const [open, setOpen] = useState(false)
  const { coupons, loading, error } = useCoupons()
  const activeCount = coupons.filter((coupon) => coupon.active).length

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="coupon-manager-title">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span id="coupon-manager-title" className="text-sm font-semibold text-foreground">
            Discount codes
          </span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {activeCount} active
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <CouponCreateForm />
          <div className="border-t border-border pt-4">
            <CouponList coupons={coupons} loading={loading} error={error} />
          </div>
        </div>
      )}
    </section>
  )
}
