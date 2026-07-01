/**
 * Tests for the portal sent-quote checkout service: public itemized view,
 * payable-state guards, reuse of an open Checkout Session (no duplicate Stripe
 * sessions per quote), and amount rebuild from the frozen input snapshot.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutPricingInput } from '../../../routes/billing/schemas'

const stripeMocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  customersCreate: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  stripeCheckoutSession: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: stripeMocks.sessionsCreate } }
    customers = { create: stripeMocks.customersCreate }
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'https://portal.test' }))

vi.mock('../../../lib/config', async (importOriginal) => {
  const actual = (await importOriginal()) as { config: Record<string, unknown> }
  return {
    config: {
      ...actual.config,
      nodeEnv: 'test',
      stripe: {
        ...(actual.config.stripe as Record<string, unknown>),
        secretKey: 'sk_test_mock',
        isConfigured: true,
        currency: 'usd',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    },
  }
})

import { createQuoteCheckoutSession, getPublicQuoteView } from '../quote-checkout-service'

const basePricingInput: CheckoutPricingInput = {
  nec1099Count: 11,
  payrollEmployees: 0,
  payrollMode: 'owner-manual',
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  customItems: [],
  rates: {
    tiers: { basicMonthly: 75, proMonthly: 85, vipMonthly: 85 },
    payroll: { baseMonthly: 50 },
    cashPlan: { setup: 1000, perEmployeeMonthly: 5, perOwnerMonthly: 50 },
    auditProtection: { monthly: 300, setup: 1000 },
    oneTime: {
      startLlc: 1500,
      holdingLlcNew: 4000,
      holdingLlcModify: 1000,
      personalTaxReturn: 150,
      businessTaxReturnFederal: 800,
      businessTaxReturnState: 100,
    },
    salesTaxMonitoringMonthly: 25,
  },
}

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote_1',
    organizationId: 'org_1',
    clientId: null,
    leadId: null,
    status: 'sent',
    customerEmail: 'client@example.com',
    inputSnapshot: { pricingInput: basePricingInput },
    resultSnapshot: {
      monthlyItems: [{ label: 'Pro plan', amount: 85, kind: 'monthly' }],
      setupItems: [{ label: 'LLC setup', amount: 1500, kind: 'setup' }],
      monthlyTotal: 85,
      setupTotal: 1500,
    },
    monthlyTotalCents: 8500,
    setupTotalCents: 150000,
    lastStripeEventAt: null,
    organization: { name: 'Acme Tax' },
    client: { firstName: 'Anna' },
    lead: null,
    appliedCoupon: null,
    payToken: 'tok_abcdefghij',
    ...overrides,
  }
}

function legacyBookkeepingServiceLabel(): string {
  return ['Monthly bookkeeping and', 'com' + 'pliance service'].join(' ')
}

function couponRow(overrides: Record<string, unknown> = {}) {
  return {
    code: 'SAVE10',
    name: 'Welcome',
    discountType: 'percent',
    percentOff: 10,
    amountOffCents: null,
    duration: 'once',
    active: true,
    stripeCouponId: 'coupon_123',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.$transaction.mockResolvedValue([])
  prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue(null)
  prismaMocks.stripeCheckoutSession.upsert.mockResolvedValue({})
  prismaMocks.paymentQuote.updateMany.mockResolvedValue({ count: 1 })
  prismaMocks.client.findFirst.mockResolvedValue(null)
  prismaMocks.client.updateMany.mockResolvedValue({ count: 1 })
  stripeMocks.customersCreate.mockResolvedValue({ id: 'cus_new' })
})

describe('getPublicQuoteView', () => {
  it('flattens snapshot lines and computes dueToday', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view).not.toBeNull()
    expect(view?.orgName).toBe('Acme Tax')
    expect(view?.recipientFirstName).toBe('Anna')
    expect(view?.lineItems).toEqual([
      { label: 'Monthly bookkeeping service', amount: 85, kind: 'monthly' },
      { label: 'LLC setup', amount: 1500, kind: 'setup' },
    ])
    expect(view?.monthlyTotal).toBe(85)
    expect(view?.setupTotal).toBe(1500)
    expect(view?.subtotal).toBe(1585)
    expect(view?.discount).toBeNull()
    expect(view?.dueToday).toBe(1585)
    expect(view?.paidAt).toBeNull()
  })

  it('sanitizes the older bookkeeping service label in public calculator quotes', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        resultSnapshot: {
          monthlyItems: [{ label: legacyBookkeepingServiceLabel(), amount: 85, kind: 'monthly' }],
          setupItems: [],
          monthlyTotal: 85,
          setupTotal: 0,
        },
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.lineItems).toEqual([
      { label: 'Monthly bookkeeping service', amount: 85, kind: 'monthly' },
    ])
  })

  it('previews an active pre-applied percent coupon on the public quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ appliedCoupon: couponRow() }))

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.subtotal).toBe(1585)
    expect(view?.discount).toEqual({
      code: 'SAVE10',
      name: 'Welcome',
      amount: 158.5,
      recurringAmount: 0,
    })
    expect(view?.dueToday).toBe(1426.5)
  })

  it('previews future recurring discount for forever amount coupons', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        monthlyTotalCents: 9900,
        setupTotalCents: 80000,
        appliedCoupon: couponRow({
          code: 'SAVE100',
          discountType: 'amount',
          percentOff: null,
          amountOffCents: 10000,
          duration: 'forever',
        }),
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.discount).toEqual({
      code: 'SAVE100',
      name: 'Welcome',
      amount: 100,
      recurringAmount: 99,
    })
    expect(view?.dueToday).toBe(799)
  })

  it('does not preview inactive or unsynced coupons', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        appliedCoupon: couponRow({ active: false, stripeCouponId: null }),
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.discount).toBeNull()
    expect(view?.dueToday).toBe(1585)
  })

  it('derives paidAt from lastStripeEventAt once settled', async () => {
    const settledAt = new Date('2026-06-08T10:00:00.000Z')
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ status: 'active', lastStripeEventAt: settledAt })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.status).toBe('active')
    expect(view?.paidAt).toBe(settledAt.toISOString())
  })

  it('prefers lead first name over client', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ lead: { firstName: 'Lead' }, client: { firstName: 'Client' } })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.recipientFirstName).toBe('Lead')
  })

  it('returns null for an unknown token', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(null)
    expect(await getPublicQuoteView('nope')).toBeNull()
  })

  it('omits billingInterval (null) for a calculator quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    const view = await getPublicQuoteView('tok_abcdefghij')
    expect(view?.billingInterval).toBeNull()
  })

  it('surfaces line descriptions and a monthly interval for a custom quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: 'month',
        resultSnapshot: {
          monthlyItems: [
            { label: 'Retainer', description: 'Monthly bookkeeping', amount: 300, kind: 'monthly' },
          ],
          setupItems: [{ label: 'Onboarding', amount: 150, kind: 'setup' }],
          monthlyTotal: 300,
          setupTotal: 150,
        },
        monthlyTotalCents: 30000,
        setupTotalCents: 15000,
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.billingInterval).toBe('month')
    expect(view?.lineItems).toEqual([
      { label: 'Retainer', description: 'Monthly bookkeeping', amount: 300, kind: 'monthly' },
      { label: 'Onboarding', amount: 150, kind: 'setup' },
    ])
    expect(view?.dueToday).toBe(450)
  })

  it('reports a yearly billing interval', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ source: 'custom', billingInterval: 'year' })
    )
    const view = await getPublicQuoteView('tok_abcdefghij')
    expect(view?.billingInterval).toBe('year')
  })

  it('moves business tax return pre-pay out of setup for public quote display', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        resultSnapshot: {
          monthlyItems: [{ label: 'Basic tier', amount: 75, kind: 'monthly' }],
          setupItems: [
            { label: 'Basic bookkeeping setup', amount: 150, kind: 'setup' },
            { label: 'Business tax return pre-pay (1 tax year)', amount: 900, kind: 'setup' },
          ],
          monthlyTotal: 75,
          setupTotal: 1050,
        },
        monthlyTotalCents: 7500,
        setupTotalCents: 105000,
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.lineItems).toEqual([
      { label: 'Monthly bookkeeping service', amount: 75, kind: 'monthly' },
      { label: 'Business tax return pre-pay (1 tax year)', amount: 900, kind: 'yearly' },
      { label: 'Bookkeeping onboarding setup', amount: 150, kind: 'setup' },
    ])
    expect(view?.setupTotal).toBe(1050)
    expect(view?.dueToday).toBe(1125)
  })

  it('does not reclassify custom-link one-time labels as yearly pre-pay', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: null,
        resultSnapshot: {
          monthlyItems: [],
          setupItems: [
            { label: 'Business tax return pre-pay (1 tax year)', amount: 500, kind: 'setup' },
          ],
          monthlyTotal: 0,
          setupTotal: 500,
        },
        monthlyTotalCents: 0,
        setupTotalCents: 50000,
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.lineItems).toEqual([
      { label: 'Business tax return pre-pay (1 tax year)', amount: 500, kind: 'setup' },
    ])
    expect(view?.billingInterval).toBeNull()
  })

  it('reports a null billing interval for a one-time custom quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: null,
        resultSnapshot: {
          monthlyItems: [],
          setupItems: [{ label: 'Single fee', amount: 500, kind: 'setup' }],
          monthlyTotal: 0,
          setupTotal: 500,
        },
        monthlyTotalCents: 0,
        setupTotalCents: 50000,
      })
    )

    const view = await getPublicQuoteView('tok_abcdefghij')

    expect(view?.billingInterval).toBeNull()
    expect(view?.monthlyTotal).toBe(0)
    expect(view?.dueToday).toBe(500)
  })
})

describe('createQuoteCheckoutSession', () => {
  it('returns null for an unknown token', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(null)
    expect(await createQuoteCheckoutSession('nope')).toBeNull()
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects an already-paid quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ status: 'paid' }))
    await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
      code: 'ALREADY_PAID',
    })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('rejects a canceled quote', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ status: 'canceled' }))
    await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
      code: 'NOT_PAYABLE',
    })
  })

  it.each(['agreement_draft', 'agreement_pending_signature', 'agreement_signed_review'])(
    'rejects unactivated agreement quote status %s',
    async (status) => {
      prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow({ status }))
      await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
        code: 'NOT_PAYABLE',
      })
      expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
    },
  )

  it('reuses an open session instead of minting a new one', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue({
      stripeSessionId: 'cs_existing',
      status: 'open',
      url: 'https://stripe.test/existing',
      expiresAt: null,
    })

    const result = await createQuoteCheckoutSession('tok_abcdefghij')

    expect(result).toEqual({ checkoutUrl: 'https://stripe.test/existing' })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('blocks a new checkout when the latest local session already completed', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue({
      stripeSessionId: 'cs_complete',
      status: 'complete',
      url: 'https://stripe.test/complete',
      expiresAt: null,
    })

    await expect(createQuoteCheckoutSession('tok_abcdefghij')).rejects.toMatchObject({
      code: 'ALREADY_PAID',
    })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('creates a subscription session pinned to the existing quote id', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_new',
      url: 'https://stripe.test/cs_new',
      status: 'open',
      customer: null,
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    const result = await createQuoteCheckoutSession('tok_abcdefghij')

    expect(result).toEqual({ checkoutUrl: 'https://stripe.test/cs_new' })
    const params = stripeMocks.sessionsCreate.mock.calls[0][0]
    expect(params.mode).toBe('subscription')
    // quoteId pinned to existing row so the webhook resolves back to this quote
    expect(params.client_reference_id).toBe('quote_1')
    expect(params.metadata.paymentQuoteId).toBe('quote_1')
    expect(params.metadata.quotePayToken).toBe('tok_abcdefghij')
    expect(params.success_url).toBe('https://portal.test/quote/tok_abcdefghij?status=success')
    expect(params.cancel_url).toBe('https://portal.test/quote/tok_abcdefghij?status=canceled')
    expect(stripeMocks.sessionsCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: 'quote-checkout:quote_1:initial',
    })
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(1)
  })

  it('uses the previous expired Checkout Session id in the retry idempotency key', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    prismaMocks.stripeCheckoutSession.findFirst.mockResolvedValue({
      stripeSessionId: 'cs_expired',
      status: 'expired',
      url: 'https://stripe.test/expired',
      expiresAt: new Date(Date.now() - 60_000),
    })
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_retry',
      url: 'https://stripe.test/cs_retry',
      status: 'open',
      customer: null,
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    await createQuoteCheckoutSession('tok_abcdefghij')

    expect(stripeMocks.sessionsCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: 'quote-checkout:quote_1:cs_expired',
    })
  })

  it('uses a persistent Stripe Customer for known client quotes', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({ clientId: 'client_1', customerEmail: 'client@example.com' }),
    )
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_1',
      firstName: 'Anna',
      lastName: 'Nguyen',
      name: 'Anna Nguyen',
      email: 'client@example.com',
      phone: '+18135550123',
      stripeCustomerId: 'cus_existing',
    })
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_client',
      url: 'https://stripe.test/cs_client',
      status: 'open',
      customer: 'cus_existing',
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    await createQuoteCheckoutSession('tok_abcdefghij')

    const params = stripeMocks.sessionsCreate.mock.calls[0][0]
    expect(params.customer).toBe('cus_existing')
    expect(params.customer_email).toBeUndefined()
  })

  it('requests Customer creation for lead-only one-time quote checkout', async () => {
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        source: 'custom',
        billingInterval: null,
        customerEmail: 'lead@example.com',
        resultSnapshot: {
          lineItems: [
            {
              label: 'Single fee',
              unitAmountCents: 50000,
              quantity: 1,
              interval: 'one_time',
            },
          ],
        },
        monthlyTotalCents: 0,
        setupTotalCents: 50000,
      }),
    )
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_one_time',
      url: 'https://stripe.test/cs_one_time',
      status: 'open',
      customer: 'cus_created',
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    await createQuoteCheckoutSession('tok_abcdefghij')

    const params = stripeMocks.sessionsCreate.mock.calls[0][0]
    expect(params.mode).toBe('payment')
    expect(params.customer_email).toBe('lead@example.com')
    expect(params.customer_creation).toBe('always')
  })

  it('rebuilds checkout line amounts from frozen calculator custom items', async () => {
    const pricingInput = {
      ...basePricingInput,
      customItems: [
        {
          id: 'custom_checkout_monthly',
          label: 'Portal checkout monthly add-on',
          amount: 40,
          quantity: 1,
          billingInterval: 'month' as const,
        },
        {
          id: 'custom_checkout_once',
          label: 'Portal checkout one-time add-on',
          amount: 60,
          quantity: 1,
          billingInterval: 'one_time' as const,
        },
      ],
    }
    prismaMocks.paymentQuote.findUnique.mockResolvedValue(
      quoteRow({
        inputSnapshot: { pricingInput },
        monthlyTotalCents: 12500,
        setupTotalCents: 21000,
      })
    )
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_custom',
      url: 'https://stripe.test/cs_custom',
      status: 'open',
      customer: null,
      subscription: null,
      payment_intent: null,
      expires_at: null,
    })

    await createQuoteCheckoutSession('tok_abcdefghij')

    const params = stripeMocks.sessionsCreate.mock.calls[0][0]
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(12500)
    expect(params.line_items?.[0]?.price_data?.product_data?.name).toBe(
      'Monthly bookkeeping service'
    )
    expect(params.line_items?.[0]?.price_data?.recurring).toEqual({ interval: 'month' })
    expect(params.line_items?.[1]?.price_data?.unit_amount).toBe(21000)
    expect(params.line_items?.[1]?.price_data?.recurring).toBeUndefined()
  })
})
