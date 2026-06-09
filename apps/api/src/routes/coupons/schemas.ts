import { z } from 'zod'

/**
 * Coupon request schemas. The app `Coupon` row is the management-UI source of
 * truth; Stripe owns the discount math. These schemas enforce the Stripe limits
 * up front (percent 1..100, positive amount cents, repeating ⇒ months) so the
 * sync call can't fail on shape.
 */

export const discountTypeEnum = z.enum(['percent', 'amount'])
export const couponDurationEnum = z.enum(['once', 'forever', 'repeating'])

/** Stripe promotion codes are case-insensitive and alphanumeric + `-`/`_`. */
const COUPON_CODE_PATTERN = /^[A-Za-z0-9_-]+$/

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(COUPON_CODE_PATTERN, 'Code may only contain letters, numbers, hyphen or underscore'),
    name: z.string().trim().max(40).optional(), // Stripe coupon `name` caps at 40 chars

    discountType: discountTypeEnum,
    percentOff: z.number().int().min(1).max(100).optional(),
    amountOffCents: z.number().int().positive().optional(),
    currency: z.string().trim().toLowerCase().length(3).optional(),
    duration: couponDurationEnum.default('once'),
    durationInMonths: z.number().int().positive().max(36).optional(),
    maxRedemptions: z.number().int().positive().optional(),
    redeemBy: z.coerce.date().optional(),
  })
  .refine((v) => (v.discountType === 'percent' ? v.percentOff != null : true), {
    message: 'percentOff is required for a percent coupon',
    path: ['percentOff'],
  })
  .refine((v) => (v.discountType === 'percent' ? v.amountOffCents == null : true), {
    message: 'amountOffCents is not allowed for a percent coupon',
    path: ['amountOffCents'],
  })
  .refine((v) => (v.discountType === 'amount' ? v.amountOffCents != null : true), {
    message: 'amountOffCents is required for an amount coupon',
    path: ['amountOffCents'],
  })
  .refine((v) => (v.discountType === 'amount' ? v.percentOff == null : true), {
    message: 'percentOff is not allowed for an amount coupon',
    path: ['percentOff'],
  })
  .refine((v) => (v.duration === 'repeating' ? v.durationInMonths != null : true), {
    message: 'durationInMonths is required when duration is repeating',
    path: ['durationInMonths'],
  })
  .refine((v) => (v.duration !== 'repeating' ? v.durationInMonths == null : true), {
    message: 'durationInMonths is only allowed when duration is repeating',
    path: ['durationInMonths'],
  })
  .refine((v) => (v.redeemBy ? v.redeemBy.getTime() > Date.now() : true), {
    message: 'redeemBy must be a future date',
    path: ['redeemBy'],
  })

export const listCouponsQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v == null ? undefined : v === 'true')),
})

export const couponIdParamSchema = z.object({
  id: z.string().cuid(),
})

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>
