import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import Stripe from 'stripe'
import type { Coupon } from '@ella/db'
import { strictRateLimit } from '../../middleware/rate-limiter'
import {
  authMiddleware,
  requireOrg,
  requireAdminOrManager,
  type AuthVariables,
} from '../../middleware/auth'
import { getVerifiedAuth } from '../leads/auth-helpers'
import {
  createCoupon,
  disableCoupon,
  listCoupons,
  CouponServiceError,
} from '../../services/coupons/coupon-service'
import { createCouponSchema, listCouponsQuerySchema, couponIdParamSchema } from './schemas'

const couponsRoute = new Hono<{ Variables: AuthVariables }>()

couponsRoute.use('*', authMiddleware, requireOrg, requireAdminOrManager)

/**
 * Client-facing coupon shape. Deliberately omits internal Stripe identifiers
 * (`stripeCouponId`, `stripePromotionCodeId`) and ownership columns
 * (`organizationId`, `createdByStaffId`) so they never reach the workspace
 * bundle. Keeps everything the management UI + discount picker need.
 */
function toCouponDto(coupon: Coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    discountType: coupon.discountType,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    currency: coupon.currency,
    duration: coupon.duration,
    durationInMonths: coupon.durationInMonths,
    maxRedemptions: coupon.maxRedemptions,
    redeemBy: coupon.redeemBy,
    timesRedeemed: coupon.timesRedeemed,
    active: coupon.active,
    createdAt: coupon.createdAt,
  }
}

couponsRoute.post(
  '/',
  strictRateLimit,
  zValidator('json', createCouponSchema),
  async (c) => {
    const { orgId, staffId } = getVerifiedAuth(c.get('user'))
    try {
      const coupon = await createCoupon(c.req.valid('json'), {
        organizationId: orgId,
        staffId,
      })
      return c.json(toCouponDto(coupon), 201)
    } catch (error) {
      return handleCouponError(c, error)
    }
  }
)

couponsRoute.get('/', zValidator('query', listCouponsQuerySchema), async (c) => {
  const { orgId } = getVerifiedAuth(c.get('user'))
  const { active } = c.req.valid('query')
  const coupons = await listCoupons(orgId, { active })
  return c.json({ coupons: coupons.map(toCouponDto) })
})

couponsRoute.patch(
  '/:id/disable',
  strictRateLimit,
  zValidator('param', couponIdParamSchema),
  async (c) => {
    const { orgId } = getVerifiedAuth(c.get('user'))
    try {
      const coupon = await disableCoupon(c.req.valid('param').id, orgId)
      return c.json(toCouponDto(coupon))
    } catch (error) {
      return handleCouponError(c, error)
    }
  }
)

function handleCouponError(c: Context, error: unknown) {
  if (error instanceof CouponServiceError) {
    switch (error.kind) {
      case 'DUPLICATE_CODE':
        return c.json({ error: error.kind, message: error.message }, 409)
      case 'NOT_FOUND':
        return c.json({ error: error.kind, message: error.message }, 404)
      case 'STRIPE_NOT_CONFIGURED':
        return c.json({ error: error.kind, message: error.message }, 503)
    }
  }
  // Don't leak Stripe's provider message/status to the client.
  if (error instanceof Stripe.errors.StripeError) {
    return c.json(
      { error: 'STRIPE_SYNC_FAILED', message: 'Failed to sync coupon with payment provider' },
      502
    )
  }
  throw error
}

export { couponsRoute }
