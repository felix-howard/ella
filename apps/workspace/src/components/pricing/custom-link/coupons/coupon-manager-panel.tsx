import { useState } from 'react'
import { Button, Modal, ModalBody, ModalDescription, ModalHeader, ModalTitle } from '@ella/ui'
import { ChevronDown, Plus, Ticket } from 'lucide-react'
import { useCoupons } from './use-coupons'
import { CouponCreateForm } from './coupon-create-form'
import { CouponList } from './coupon-list'

/**
 * Discount-code management for the Custom link tab. Shows the coupon table by
 * default and opens creation in a modal to keep scanning existing codes fast.
 */
export function CouponManagerPanel() {
  const [open, setOpen] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const { coupons, loading, error } = useCoupons()
  const activeCount = coupons.filter((coupon) => coupon.active).length

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="coupon-manager-title">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex min-h-10 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Ticket className="h-4 w-4 text-primary" />
          <span className="flex items-baseline gap-2">
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

        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add discount code
        </Button>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <CouponList coupons={coupons} loading={loading} error={error} />
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        size="full"
        aria-labelledby="coupon-create-modal-title"
        aria-describedby="coupon-create-modal-description"
      >
        <ModalHeader>
          <ModalTitle id="coupon-create-modal-title">Create discount code</ModalTitle>
          <ModalDescription id="coupon-create-modal-description">
            Add a coupon that can be applied to custom payment links.
          </ModalDescription>
        </ModalHeader>
        <ModalBody>
          <CouponCreateForm onCreated={() => setCreateOpen(false)} />
        </ModalBody>
      </Modal>
    </section>
  )
}
