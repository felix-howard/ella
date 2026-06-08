import { useState } from 'react'
import { Badge, Button } from '@ella/ui'
import { Loader2 } from 'lucide-react'
import type { CouponSummary } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'
import { useDisableCoupon } from './use-coupons'
import {
  discountSummary,
  durationSummary,
  expirySummary,
  redemptionSummary,
} from './coupon-format'

interface CouponListProps {
  coupons: CouponSummary[]
  loading: boolean
  error: Error | null
}

/** Table of all coupons with discount/duration/redemption/status + disable. */
export function CouponList({ coupons, loading, error }: CouponListProps) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading coupons…
      </p>
    )
  }

  if (error) {
    return <p className="py-4 text-xs text-error">Could not load coupons. {error.message}</p>
  }

  if (coupons.length === 0) {
    return (
      <p className="py-4 text-xs text-muted-foreground">
        No coupons yet. Create one above to pre-apply discounts on custom links.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Duration</Th>
            <Th>Used</Th>
            <Th>Expires</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <CouponRow key={coupon.id} coupon={coupon} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CouponRow({ coupon }: { coupon: CouponSummary }) {
  const [confirming, setConfirming] = useState(false)
  const disableCoupon = useDisableCoupon()

  const handleDisable = async () => {
    try {
      await disableCoupon.mutateAsync(coupon.id)
      toast.success(`Coupon ${coupon.code} disabled`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disable coupon')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <Td>
        <span className="font-medium text-foreground">{coupon.code}</span>
        {coupon.name && <span className="block text-muted-foreground">{coupon.name}</span>}
      </Td>
      <Td>{discountSummary(coupon) || '—'}</Td>
      <Td>{durationSummary(coupon)}</Td>
      <Td>{redemptionSummary(coupon)}</Td>
      <Td>{expirySummary(coupon) ?? '—'}</Td>
      <Td>
        <Badge variant={coupon.active ? 'success' : 'secondary'}>
          {coupon.active ? 'Active' : 'Disabled'}
        </Badge>
      </Td>
      <Td className="text-right">
        {!coupon.active ? (
          <span className="text-muted-foreground">—</span>
        ) : confirming ? (
          <span className="inline-flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCoupon.isPending}
            >
              {disableCoupon.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={disableCoupon.isPending}
            >
              Cancel
            </Button>
          </span>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Disable
          </Button>
        )}
      </Td>
    </tr>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>
}
