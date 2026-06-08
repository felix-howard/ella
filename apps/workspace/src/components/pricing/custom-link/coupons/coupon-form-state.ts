/**
 * Draft state + client-side validation for the create-coupon form.
 * Mirrors the API `createCouponSchema` (Phase 4) so invalid input is rejected
 * before a request is made; the server re-validates as the source of truth.
 */
import { MAX_UNIT_AMOUNT_CENTS } from '../custom-link-types'
import type { CreateCouponInput } from '../../../../lib/api-client'

export type CouponDiscountType = 'percent' | 'amount'
export type CouponDuration = 'once' | 'forever' | 'repeating'

/** Raw string-backed form fields (what the user types). */
export interface CouponFormState {
  code: string
  name: string
  discountType: CouponDiscountType
  percentOff: string
  /** Dollar amount as typed; converted to cents on submit. */
  amountOff: string
  duration: CouponDuration
  durationInMonths: string
  maxRedemptions: string
  /** `<input type="date">` value (YYYY-MM-DD), or '' for open-ended. */
  redeemBy: string
}

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/

export function createEmptyCouponForm(): CouponFormState {
  return {
    code: '',
    name: '',
    discountType: 'percent',
    percentOff: '',
    amountOff: '',
    duration: 'once',
    durationInMonths: '',
    maxRedemptions: '',
    redeemBy: '',
  }
}

export type CouponFormErrors = Partial<Record<keyof CouponFormState, string>>

export interface CouponFormValidation {
  errors: CouponFormErrors
  /** Built payload when there are zero errors, else null. */
  payload: CreateCouponInput | null
}

/** Validate the draft and, when clean, build the API payload. */
export function validateCouponForm(form: CouponFormState): CouponFormValidation {
  const errors: CouponFormErrors = {}

  const code = form.code.trim()
  if (!code) errors.code = 'Code is required.'
  else if (code.length > 64) errors.code = 'Code is at most 64 characters.'
  else if (!CODE_PATTERN.test(code)) errors.code = 'Use letters, numbers, hyphen or underscore only.'

  const name = form.name.trim()
  if (name.length > 40) errors.name = 'Name is at most 40 characters.'

  let percentOff: number | undefined
  let amountOffCents: number | undefined
  if (form.discountType === 'percent') {
    percentOff = Number.parseInt(form.percentOff.trim(), 10)
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
      errors.percentOff = 'Enter a whole percent between 1 and 100.'
    }
  } else {
    const dollars = Number.parseFloat(form.amountOff.trim())
    if (!Number.isFinite(dollars) || dollars < 0.01) {
      errors.amountOff = 'Enter an amount of at least $0.01.'
    } else {
      const cents = Math.round(dollars * 100)
      if (cents > MAX_UNIT_AMOUNT_CENTS) errors.amountOff = 'Amount off is too large.'
      else amountOffCents = cents
    }
  }

  let durationInMonths: number | undefined
  if (form.duration === 'repeating') {
    durationInMonths = Number.parseInt(form.durationInMonths.trim(), 10)
    if (!Number.isInteger(durationInMonths) || durationInMonths < 1 || durationInMonths > 36) {
      errors.durationInMonths = 'Enter a number of months between 1 and 36.'
    }
  }

  let maxRedemptions: number | undefined
  if (form.maxRedemptions.trim()) {
    maxRedemptions = Number.parseInt(form.maxRedemptions.trim(), 10)
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1) {
      errors.maxRedemptions = 'Usage limit must be a positive whole number.'
    }
  }

  let redeemBy: string | undefined
  if (form.redeemBy.trim()) {
    // `<input type="date">` is a local calendar day. Treat it as local end-of-day
    // so "expires today" is valid and the stored instant renders back as the same
    // day in the user's zone (avoids a UTC-parse off-by-one).
    const [y, m, d] = form.redeemBy.split('-').map(Number)
    const date = y && m && d ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(NaN)
    if (Number.isNaN(date.getTime())) errors.redeemBy = 'Enter a valid date.'
    else if (date.getTime() <= Date.now()) errors.redeemBy = 'Expiry must be in the future.'
    else redeemBy = date.toISOString()
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null }

  return {
    errors,
    payload: {
      code,
      discountType: form.discountType,
      duration: form.duration,
      ...(name ? { name } : {}),
      ...(percentOff != null ? { percentOff } : {}),
      ...(amountOffCents != null ? { amountOffCents } : {}),
      ...(durationInMonths != null ? { durationInMonths } : {}),
      ...(maxRedemptions != null ? { maxRedemptions } : {}),
      ...(redeemBy ? { redeemBy } : {}),
    },
  }
}
