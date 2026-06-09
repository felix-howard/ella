import Stripe from 'stripe'
import { Prisma, type Coupon } from '@ella/db'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { assertStripeConfigured } from '../stripe/client'
import {
  createStripeCoupon,
  createStripePromotionCode,
  deactivatePromotionCode,
  deleteStripeCoupon,
  fetchRedemptionCount,
} from './stripe-coupon-sync'
import type { CreateCouponInput } from '../../routes/coupons/schemas'

/**
 * Coupon CRUD. Every create is mirrored to a Stripe Coupon + Promotion Code so
 * Stripe applies the discount natively at checkout (Phase 3). The app row is the
 * source of truth for the management UI; Stripe owns the math + redemption count.
 */

export type CouponErrorKind = 'DUPLICATE_CODE' | 'NOT_FOUND' | 'STRIPE_NOT_CONFIGURED'

export class CouponServiceError extends Error {
  constructor(public readonly kind: CouponErrorKind, message: string) {
    super(message)
    this.name = 'CouponServiceError'
  }
}

export interface CouponContext {
  organizationId: string
  staffId: string
}

export async function createCoupon(
  input: CreateCouponInput,
  ctx: CouponContext
): Promise<Coupon> {
  assertStripeConfiguredOrThrow()

  const code = input.code.trim().toUpperCase()
  await assertCodeAvailable(code, ctx.organizationId)

  const currency = input.currency ?? config.stripe.currency

  // Order: Stripe coupon → Stripe promo code → DB row. On any later failure,
  // best-effort roll back the earlier Stripe objects so we never persist a row
  // pointing at a half-created discount (or leave an orphan in Stripe).
  const stripeCoupon = await createStripeCoupon({
    discountType: input.discountType,
    percentOff: input.percentOff,
    amountOffCents: input.amountOffCents,
    currency,
    duration: input.duration,
    durationInMonths: input.durationInMonths,
    maxRedemptions: input.maxRedemptions,
    redeemBy: input.redeemBy,
    name: input.name,
  })

  let stripePromotionCodeId: string
  try {
    const promo = await createStripePromotionCode(stripeCoupon.id, code)
    stripePromotionCodeId = promo.id
  } catch (error) {
    await deleteStripeCoupon(stripeCoupon.id)
    // Stripe promo `code` is unique per Stripe ACCOUNT (across orgs); a clash that
    // slipped past the per-org DB check surfaces here — map it to a clean 409.
    if (isStripeDuplicateCode(error)) throw duplicateCodeError(code)
    throw error
  }

  try {
    return await prisma.coupon.create({
      data: {
        organizationId: ctx.organizationId,
        code,
        name: input.name,
        discountType: input.discountType,
        percentOff: input.percentOff,
        amountOffCents: input.amountOffCents,
        currency,
        duration: input.duration,
        durationInMonths: input.durationInMonths,
        maxRedemptions: input.maxRedemptions,
        redeemBy: input.redeemBy,
        stripeCouponId: stripeCoupon.id,
        stripePromotionCodeId,
        createdByStaffId: ctx.staffId,
      },
    })
  } catch (error) {
    // Deleting the Stripe coupon cascades to its promotion codes, so no separate
    // promo-code deactivation is needed on this rollback path.
    await deleteStripeCoupon(stripeCoupon.id)
    if (isUniqueViolation(error)) {
      throw duplicateCodeError(code)
    }
    throw error
  }
}

export async function listCoupons(
  organizationId: string,
  filter: { active?: boolean } = {}
): Promise<Coupon[]> {
  return prisma.coupon.findMany({
    where: {
      organizationId,
      ...(filter.active === undefined ? {} : { active: filter.active }),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function disableCoupon(id: string, organizationId: string): Promise<Coupon> {
  const coupon = await prisma.coupon.findFirst({ where: { id, organizationId } })
  if (!coupon) throw new CouponServiceError('NOT_FOUND', 'Coupon not found')

  // Stripe coupons aren't editable; "disable" = deactivate the promo code so it
  // can no longer be redeemed. Keep the row for history + the unique [org, code].
  if (coupon.stripePromotionCodeId) {
    await deactivatePromotionCode(coupon.stripePromotionCodeId)
  }

  return prisma.coupon.update({ where: { id: coupon.id }, data: { active: false } })
}

/** Used by Phase 3 to attach an owner-selected coupon to a checkout session. */
export async function getActiveCouponById(
  id: string,
  organizationId: string
): Promise<Coupon | null> {
  return prisma.coupon.findFirst({ where: { id, organizationId, active: true } })
}

/** Refresh the cached redemption count from Stripe (lazy / on-demand only). */
export async function refreshRedemptionCount(
  id: string,
  organizationId: string
): Promise<Coupon> {
  const coupon = await prisma.coupon.findFirst({ where: { id, organizationId } })
  if (!coupon) throw new CouponServiceError('NOT_FOUND', 'Coupon not found')
  if (!coupon.stripeCouponId) return coupon

  const timesRedeemed = await fetchRedemptionCount(coupon.stripeCouponId)
  return prisma.coupon.update({ where: { id: coupon.id }, data: { timesRedeemed } })
}

function assertStripeConfiguredOrThrow(): void {
  try {
    assertStripeConfigured()
  } catch {
    throw new CouponServiceError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured')
  }
}

async function assertCodeAvailable(code: string, organizationId: string): Promise<void> {
  const existing = await prisma.coupon.findUnique({
    where: { organizationId_code: { organizationId, code } },
  })
  if (existing) throw duplicateCodeError(code)
}

function duplicateCodeError(code: string): CouponServiceError {
  return new CouponServiceError('DUPLICATE_CODE', `Coupon code "${code}" already exists`)
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/** A Stripe "promotion code already exists" clash (account-global code uniqueness). */
function isStripeDuplicateCode(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false
  if (error.code === 'resource_already_exists') return true
  return /already exists/i.test(error.message ?? '')
}
