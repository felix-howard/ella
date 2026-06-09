import { beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { Prisma } from '@ella/db'

vi.mock('../../../lib/db', () => ({
  prisma: {
    coupon: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/config', () => ({
  config: { stripe: { currency: 'usd', isConfigured: true } },
}))

vi.mock('../../stripe/client', () => ({
  assertStripeConfigured: vi.fn(),
}))

vi.mock('../stripe-coupon-sync', () => ({
  createStripeCoupon: vi.fn(),
  createStripePromotionCode: vi.fn(),
  deactivatePromotionCode: vi.fn(),
  deleteStripeCoupon: vi.fn(),
  fetchRedemptionCount: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { assertStripeConfigured } from '../../stripe/client'
import {
  createStripeCoupon,
  createStripePromotionCode,
  deactivatePromotionCode,
  deleteStripeCoupon,
} from '../stripe-coupon-sync'
import {
  createCoupon,
  disableCoupon,
  CouponServiceError,
  type CouponContext,
} from '../coupon-service'

const ctx: CouponContext = { organizationId: 'org_1', staffId: 'staff_1' }

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  asMock(assertStripeConfigured).mockReturnValue(undefined)
  asMock(prisma.coupon.findUnique).mockResolvedValue(null)
  asMock(createStripeCoupon).mockResolvedValue({ id: 'co_stripe' })
  asMock(createStripePromotionCode).mockResolvedValue({ id: 'promo_stripe' })
  asMock(deactivatePromotionCode).mockResolvedValue(undefined)
  asMock(deleteStripeCoupon).mockResolvedValue(undefined)
  asMock(prisma.coupon.create).mockImplementation(async ({ data }: { data: object }) => ({
    id: 'cpn_1',
    ...data,
  }))
})

describe('createCoupon', () => {
  it('creates a percent coupon, mirrors to Stripe, persists both IDs + uppercased code', async () => {
    const result = await createCoupon(
      { code: 'welcome10', discountType: 'percent', percentOff: 10, duration: 'once' },
      ctx
    )

    expect(createStripeCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ discountType: 'percent', percentOff: 10, duration: 'once' })
    )
    expect(createStripePromotionCode).toHaveBeenCalledWith('co_stripe', 'WELCOME10')
    expect(asMock(prisma.coupon.create).mock.calls[0][0].data).toMatchObject({
      organizationId: 'org_1',
      code: 'WELCOME10',
      stripeCouponId: 'co_stripe',
      stripePromotionCodeId: 'promo_stripe',
      createdByStaffId: 'staff_1',
    })
    expect(result.id).toBe('cpn_1')
  })

  it('creates an amount coupon defaulting currency from config', async () => {
    await createCoupon(
      { code: 'SAVE5', discountType: 'amount', amountOffCents: 500, duration: 'forever' },
      ctx
    )

    expect(createStripeCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ discountType: 'amount', amountOffCents: 500, currency: 'usd' })
    )
    expect(asMock(prisma.coupon.create).mock.calls[0][0].data).toMatchObject({ currency: 'usd' })
  })

  it('rejects a duplicate [org, code] before calling Stripe (409 kind)', async () => {
    asMock(prisma.coupon.findUnique).mockResolvedValue({ id: 'existing' })

    await expect(
      createCoupon({ code: 'DUP', discountType: 'percent', percentOff: 10, duration: 'once' }, ctx)
    ).rejects.toMatchObject({ kind: 'DUPLICATE_CODE' })
    expect(createStripeCoupon).not.toHaveBeenCalled()
  })

  it('rolls back the Stripe coupon when promo-code creation fails', async () => {
    asMock(createStripePromotionCode).mockRejectedValue(new Error('stripe boom'))

    await expect(
      createCoupon({ code: 'X', discountType: 'percent', percentOff: 10, duration: 'once' }, ctx)
    ).rejects.toThrow('stripe boom')
    expect(deleteStripeCoupon).toHaveBeenCalledWith('co_stripe')
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  it('maps a DB unique violation to DUPLICATE_CODE and rolls back Stripe', async () => {
    asMock(prisma.coupon.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' })
    )

    await expect(
      createCoupon({ code: 'X', discountType: 'percent', percentOff: 10, duration: 'once' }, ctx)
    ).rejects.toMatchObject({ kind: 'DUPLICATE_CODE' })
    // Deleting the Stripe coupon cascades to its promo codes — no separate deactivate.
    expect(deleteStripeCoupon).toHaveBeenCalledWith('co_stripe')
  })

  it('maps a Stripe account-global code clash to DUPLICATE_CODE', async () => {
    asMock(createStripePromotionCode).mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'A promotion code already exists with this code.',
      })
    )

    await expect(
      createCoupon({ code: 'X', discountType: 'percent', percentOff: 10, duration: 'once' }, ctx)
    ).rejects.toMatchObject({ kind: 'DUPLICATE_CODE' })
    expect(deleteStripeCoupon).toHaveBeenCalledWith('co_stripe')
  })

  it('throws STRIPE_NOT_CONFIGURED when Stripe creds are missing', async () => {
    asMock(assertStripeConfigured).mockImplementation(() => {
      throw new Error('Stripe is not configured')
    })

    await expect(
      createCoupon({ code: 'X', discountType: 'percent', percentOff: 10, duration: 'once' }, ctx)
    ).rejects.toMatchObject({ kind: 'STRIPE_NOT_CONFIGURED' })
  })
})

describe('disableCoupon', () => {
  it('deactivates the Stripe promo code and soft-disables the row', async () => {
    asMock(prisma.coupon.findFirst).mockResolvedValue({
      id: 'cpn_1',
      stripePromotionCodeId: 'promo_stripe',
    })
    asMock(prisma.coupon.update).mockResolvedValue({ id: 'cpn_1', active: false })

    const result = await disableCoupon('cpn_1', 'org_1')

    expect(deactivatePromotionCode).toHaveBeenCalledWith('promo_stripe')
    expect(asMock(prisma.coupon.update).mock.calls[0][0]).toMatchObject({
      where: { id: 'cpn_1' },
      data: { active: false },
    })
    expect(result.active).toBe(false)
  })

  it('throws NOT_FOUND for a coupon outside the org', async () => {
    asMock(prisma.coupon.findFirst).mockResolvedValue(null)

    await expect(disableCoupon('missing', 'org_1')).rejects.toBeInstanceOf(CouponServiceError)
    await expect(disableCoupon('missing', 'org_1')).rejects.toMatchObject({ kind: 'NOT_FOUND' })
  })
})
