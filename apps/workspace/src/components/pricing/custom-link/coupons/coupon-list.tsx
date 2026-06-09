import { useState } from 'react'
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
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
  const [couponToDisable, setCouponToDisable] = useState<CouponSummary | null>(null)
  const disableCoupon = useDisableCoupon()

  const handleDisable = async () => {
    if (!couponToDisable) return

    try {
      await disableCoupon.mutateAsync(couponToDisable.id)
      toast.success(`Coupon ${couponToDisable.code} disabled`)
      setCouponToDisable(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disable coupon')
    }
  }

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
        No coupons yet. Add a discount code to pre-apply discounts on custom links.
      </p>
    )
  }

  return (
    <>
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
              <CouponRow
                key={coupon.id}
                coupon={coupon}
                onRequestDisable={setCouponToDisable}
              />
            ))}
          </tbody>
        </table>
      </div>

      <DisableCouponConfirmModal
        coupon={couponToDisable}
        isPending={disableCoupon.isPending}
        onCancel={() => setCouponToDisable(null)}
        onConfirm={handleDisable}
      />
    </>
  )
}

function CouponRow({
  coupon,
  onRequestDisable,
}: {
  coupon: CouponSummary
  onRequestDisable: (coupon: CouponSummary) => void
}) {
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
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => onRequestDisable(coupon)}>
            Disable
          </Button>
        )}
      </Td>
    </tr>
  )
}

function DisableCouponConfirmModal({
  coupon,
  isPending,
  onCancel,
  onConfirm,
}: {
  coupon: CouponSummary | null
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = 'disable-coupon-confirm-title'
  const descriptionId = 'disable-coupon-confirm-description'

  return (
    <Modal
      open={Boolean(coupon)}
      onClose={() => {
        if (!isPending) onCancel()
      }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <ModalHeader>
        <ModalTitle id={titleId}>Disable discount code?</ModalTitle>
        <ModalDescription id={descriptionId}>
          This will stop <span className="font-semibold text-foreground">{coupon?.code}</span> from being used on new
          payment links. Existing Stripe checkout sessions keep their current discount.
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium text-foreground">{coupon?.code}</p>
          {coupon?.name && <p className="mt-1 text-muted-foreground">{coupon.name}</p>}
          <p className="mt-2 text-muted-foreground">
            {coupon ? discountSummary(coupon) || 'No discount summary' : ''}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Disable
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>
}
