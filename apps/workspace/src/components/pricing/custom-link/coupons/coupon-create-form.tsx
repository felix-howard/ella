import { useState } from 'react'
import { Button, Input, Select } from '@ella/ui'
import { Loader2, Plus } from 'lucide-react'
import { toast } from '../../../../stores/toast-store'
import { useCreateCoupon } from './use-coupons'
import {
  createEmptyCouponForm,
  validateCouponForm,
  type CouponFormErrors,
  type CouponFormState,
} from './coupon-form-state'

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percent', label: 'Percent off' },
  { value: 'amount', label: 'Amount off' },
]

const DURATION_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'forever', label: 'Forever' },
  { value: 'repeating', label: 'Repeating (months)' },
]

/** Create-coupon form with conditional fields driven by discountType/duration. */
export function CouponCreateForm() {
  const [form, setForm] = useState<CouponFormState>(createEmptyCouponForm)
  const [errors, setErrors] = useState<CouponFormErrors>({})
  const createCoupon = useCreateCoupon()

  const set = (patch: Partial<CouponFormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { errors: nextErrors, payload } = validateCouponForm(form)
    setErrors(nextErrors)
    if (!payload) return
    try {
      const coupon = await createCoupon.mutateAsync(payload)
      toast.success(`Coupon ${coupon.code} created`)
      setForm(createEmptyCouponForm())
      setErrors({})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create coupon')
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
      <Field label="Code" htmlFor="coupon-code" error={errors.code}>
        <Input
          id="coupon-code"
          value={form.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          placeholder="WELCOME10"
          maxLength={64}
          aria-invalid={Boolean(errors.code)}
        />
      </Field>

      <Field label="Name (optional)" htmlFor="coupon-name" error={errors.name}>
        <Input
          id="coupon-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Welcome discount"
          maxLength={40}
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <Field label="Discount type" htmlFor="coupon-discount-type">
        <Select
          id="coupon-discount-type"
          options={DISCOUNT_TYPE_OPTIONS}
          value={form.discountType}
          onChange={(e) =>
            set({ discountType: e.target.value as CouponFormState['discountType'] })
          }
        />
      </Field>

      {form.discountType === 'percent' ? (
        <Field label="Percent off" htmlFor="coupon-percent" error={errors.percentOff}>
          <Input
            id="coupon-percent"
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            value={form.percentOff}
            onChange={(e) => set({ percentOff: e.target.value })}
            placeholder="10"
            aria-invalid={Boolean(errors.percentOff)}
          />
        </Field>
      ) : (
        <Field label="Amount off ($)" htmlFor="coupon-amount" error={errors.amountOff}>
          <Input
            id="coupon-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.amountOff}
            onChange={(e) => set({ amountOff: e.target.value })}
            placeholder="100.00"
            aria-invalid={Boolean(errors.amountOff)}
          />
        </Field>
      )}

      <Field label="Duration" htmlFor="coupon-duration">
        <Select
          id="coupon-duration"
          options={DURATION_OPTIONS}
          value={form.duration}
          onChange={(e) => set({ duration: e.target.value as CouponFormState['duration'] })}
        />
      </Field>

      {form.duration === 'repeating' && (
        <Field label="Months" htmlFor="coupon-months" error={errors.durationInMonths}>
          <Input
            id="coupon-months"
            type="number"
            inputMode="numeric"
            min="1"
            max="36"
            value={form.durationInMonths}
            onChange={(e) => set({ durationInMonths: e.target.value })}
            placeholder="3"
            aria-invalid={Boolean(errors.durationInMonths)}
          />
        </Field>
      )}

      <Field label="Usage limit (optional)" htmlFor="coupon-max" error={errors.maxRedemptions}>
        <Input
          id="coupon-max"
          type="number"
          inputMode="numeric"
          min="1"
          value={form.maxRedemptions}
          onChange={(e) => set({ maxRedemptions: e.target.value })}
          placeholder="Unlimited"
          aria-invalid={Boolean(errors.maxRedemptions)}
        />
      </Field>

      <Field label="Expires (optional)" htmlFor="coupon-expiry" error={errors.redeemBy}>
        <Input
          id="coupon-expiry"
          type="date"
          value={form.redeemBy}
          onChange={(e) => set({ redeemBy: e.target.value })}
          aria-invalid={Boolean(errors.redeemBy)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Button type="submit" className="w-full" disabled={createCoupon.isPending}>
          {createCoupon.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create coupon
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
      <span className="mb-1 block">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] text-error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
