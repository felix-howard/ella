import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckoutSession } from '../checkout'
import { checkoutRequest } from './checkout-fixtures'

const stripeMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    create: vi.fn(),
    update: vi.fn(),
  },
  stripeCheckoutSession: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = {
      sessions: {
        create: stripeMocks.createSession,
      },
    }
  },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    nodeEnv: 'development',
    stripe: {
      isConfigured: true,
      secretKey: 'sk_test_mock',
      successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://example.com/cancel',
      currency: 'usd',
    },
  },
}))

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

describe('Stripe checkout persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.paymentQuote.create.mockResolvedValue({})
    prismaMocks.paymentQuote.update.mockResolvedValue({})
    prismaMocks.stripeCheckoutSession.create.mockResolvedValue({})
    prismaMocks.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations)
    )
  })

  it('creates a payment quote before Stripe and stores the returned session', async () => {
    stripeMocks.createSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/cs_test_123',
      status: 'open',
      expires_at: 1_800_000_000,
      customer: 'cus_123',
      subscription: 'sub_123',
      payment_intent: null,
    })

    const result = await createCheckoutSession(checkoutRequest(), {
      organizationId: 'org_1',
      createdByStaffId: 'staff_1',
    })

    const quoteCreate = prismaMocks.paymentQuote.create.mock.calls[0]?.[0]
    const quoteId = quoteCreate?.data.id

    expect(result).toEqual({
      quoteId,
      checkoutUrl: 'https://checkout.stripe.com/cs_test_123',
      sessionId: 'cs_test_123',
    })
    expect(quoteCreate?.data).toMatchObject({
      organizationId: 'org_1',
      createdByStaffId: 'staff_1',
      customerEmail: 'client@example.com',
      customerName: 'Test Client',
      businessName: 'Test Business',
      status: 'pending_checkout',
    })
    expect(quoteCreate?.data.monthlyTotalCents).toBeGreaterThan(0)
    expect(quoteCreate?.data.setupTotalCents).toBeGreaterThan(0)
    expect(quoteCreate?.data.inputSnapshot).not.toHaveProperty('quoteNotes')
    expect(prismaMocks.paymentQuote.create.mock.invocationCallOrder[0]).toBeLessThan(
      stripeMocks.createSession.mock.invocationCallOrder[0]
    )
    expect(stripeMocks.createSession.mock.calls[0]?.[0].metadata).toMatchObject({
      paymentQuoteId: quoteId,
      quoteId,
    })
    expect(stripeMocks.createSession.mock.calls[0]?.[0].metadata).not.toHaveProperty('customerName')
    expect(stripeMocks.createSession.mock.calls[0]?.[0].metadata).not.toHaveProperty('businessName')
    expect(stripeMocks.createSession.mock.calls[0]?.[1]).toEqual({ idempotencyKey: quoteId })
    expect(prismaMocks.stripeCheckoutSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentQuoteId: quoteId,
        stripeSessionId: 'cs_test_123',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        status: 'open',
        url: 'https://checkout.stripe.com/cs_test_123',
        expiresAt: expect.any(Date),
      }),
    })
    expect(prismaMocks.paymentQuote.update).toHaveBeenCalledWith({
      where: { id: quoteId },
      data: { status: 'checkout_created' },
    })
  })

  it('marks the quote failed when Stripe rejects session creation', async () => {
    stripeMocks.createSession.mockRejectedValue(new Error('Stripe unavailable'))

    await expect(createCheckoutSession(checkoutRequest())).rejects.toThrow('Stripe unavailable')

    const quoteId = prismaMocks.paymentQuote.create.mock.calls[0]?.[0].data.id
    expect(prismaMocks.paymentQuote.update).toHaveBeenCalledWith({
      where: { id: quoteId },
      data: { status: 'stripe_create_failed' },
    })
    expect(prismaMocks.stripeCheckoutSession.create).not.toHaveBeenCalled()
  })

  it('marks the quote when local session persistence fails after Stripe success', async () => {
    stripeMocks.createSession.mockResolvedValue({
      id: 'cs_test_orphan',
      url: 'https://checkout.stripe.com/cs_test_orphan',
      status: 'open',
      expires_at: null,
      customer: null,
      subscription: null,
      payment_intent: null,
    })
    prismaMocks.$transaction.mockRejectedValue(new Error('DB write failed'))

    await expect(createCheckoutSession(checkoutRequest())).rejects.toThrow('DB write failed')

    const quoteId = prismaMocks.paymentQuote.create.mock.calls[0]?.[0].data.id
    expect(prismaMocks.paymentQuote.update).toHaveBeenCalledWith({
      where: { id: quoteId },
      data: { status: 'checkout_persist_failed' },
    })
  })

  it('marks the quote when Stripe omits the checkout URL', async () => {
    stripeMocks.createSession.mockResolvedValue({
      id: 'cs_test_no_url',
      url: null,
      status: 'open',
      expires_at: null,
      customer: null,
      subscription: null,
      payment_intent: null,
    })

    await expect(createCheckoutSession(checkoutRequest())).rejects.toThrow(
      'Stripe did not return a Checkout URL'
    )

    const quoteId = prismaMocks.paymentQuote.create.mock.calls[0]?.[0].data.id
    expect(prismaMocks.paymentQuote.update).toHaveBeenCalledWith({
      where: { id: quoteId },
      data: { status: 'stripe_missing_url' },
    })
    expect(prismaMocks.stripeCheckoutSession.create).not.toHaveBeenCalled()
  })
})
