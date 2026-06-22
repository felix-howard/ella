/**
 * Tests for the portal deposit checkout service: public payment view,
 * Stripe Checkout Session creation (amount always from DB), and webhook
 * fulfillment idempotency (duplicate event → no double mutate/notify).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const stripeMocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  payment: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  agreement: {
    updateMany: vi.fn(),
  },
}))

const notifyMocks = vi.hoisted(() => ({
  smsOptedInAdmins: vi.fn(),
}))

const signerSmsMocks = vi.hoisted(() => ({
  sendSignerSmsAndPersist: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    checkout = {
      sessions: { create: stripeMocks.sessionsCreate, retrieve: stripeMocks.sessionsRetrieve },
    }
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

vi.mock('../../../lib/config', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    config: { stripe: Record<string, unknown> } & Record<string, unknown>
  }
  return {
    config: {
      ...actual.config,
      nodeEnv: 'test',
      portalUrl: 'http://portal.test',
      stripe: {
        ...actual.config.stripe,
        secretKey: 'sk_test_mock',
        isConfigured: true,
      },
    },
  }
})

vi.mock('../../agreements/agreement-post-sign-notifications', () => notifyMocks)
vi.mock('../signer-sms-delivery', () => signerSmsMocks)

import {
  DepositCheckoutError,
  createDepositCheckoutSession,
  getPublicPaymentView,
  markDepositPaymentPaid,
  reconcileDepositPaymentFromStripe,
} from '../deposit-checkout-service'

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    organizationId: 'org_1',
    agreementId: 'agr_1',
    status: 'PENDING',
    amount: { toString: () => '300' },
    currency: 'usd',
    description: 'Initial payment - 2026 Engagement Letter',
    payToken: 'tok_abc',
    paidAt: null,
    organization: { name: 'Acme Tax' },
    client: null,
    lead: { id: 'lead_1', firstName: 'Anna', lastName: 'Nguyen', email: 'anna@test.com' },
    agreement: { id: 'agr_1', title: '2026 Engagement Letter', createdByUserId: 'staff_1' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.payment.findUnique.mockResolvedValue(paymentRow())
  prismaMocks.payment.update.mockResolvedValue({})
  prismaMocks.payment.updateMany.mockResolvedValue({ count: 1 })
  prismaMocks.agreement.updateMany.mockResolvedValue({ count: 1 })
  notifyMocks.smsOptedInAdmins.mockResolvedValue([])
  signerSmsMocks.sendSignerSmsAndPersist.mockResolvedValue(undefined)
  stripeMocks.sessionsCreate.mockResolvedValue({
    id: 'cs_dep_123',
    url: 'https://checkout.stripe.com/c/pay/cs_dep_123',
  })
})

describe('getPublicPaymentView', () => {
  it('returns null for an unknown payToken', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(null)

    expect(await getPublicPaymentView('tok_unknown')).toBeNull()
  })

  it('returns the minimal public view, preferring the lead first name', async () => {
    const view = await getPublicPaymentView('tok_abc')

    expect(view).toEqual({
      amount: '300',
      currency: 'usd',
      description: 'Initial payment - 2026 Engagement Letter',
      status: 'PENDING',
      clientFirstName: 'Anna',
      organizationName: 'Acme Tax',
      paidAt: null,
    })
  })

  it('normalizes legacy retainer descriptions before returning public view', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ description: 'Retainer – 2026 Engagement Letter' }),
    )

    const view = await getPublicPaymentView('tok_abc')

    expect(view?.description).toBe('Initial payment - 2026 Engagement Letter')
  })
})

describe('createDepositCheckoutSession', () => {
  it('returns null for an unknown payToken', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(null)

    expect(await createDepositCheckoutSession('tok_unknown')).toBeNull()
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it.each(['PAID', 'REFUNDED'])('throws ALREADY_PAID for a %s payment', async (status) => {
    prismaMocks.payment.findUnique.mockResolvedValue(paymentRow({ status }))

    await expect(createDepositCheckoutSession('tok_abc')).rejects.toMatchObject({
      name: 'DepositCheckoutError',
      code: 'ALREADY_PAID',
    })
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled()
  })

  it('throws NOT_PAYABLE for a CANCELED payment', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(paymentRow({ status: 'CANCELED' }))

    await expect(createDepositCheckoutSession('tok_abc')).rejects.toMatchObject({
      code: 'NOT_PAYABLE',
    })
  })

  it('creates a payment-mode session with the amount from the DB row', async () => {
    const result = await createDepositCheckoutSession('tok_abc')

    expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_dep_123' })
    expect(stripeMocks.sessionsCreate).toHaveBeenCalledWith({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: 30000, // 300 USD from DB — never from the request
            product_data: { name: 'Initial payment - 2026 Engagement Letter' },
          },
        },
      ],
      success_url: 'http://portal.test/pay/tok_abc?status=success',
      cancel_url: 'http://portal.test/pay/tok_abc?status=canceled',
      customer_email: 'anna@test.com',
      client_reference_id: 'pay_1',
      metadata: { payToken: 'tok_abc', paymentId: 'pay_1', agreementId: 'agr_1' },
    })
    expect(prismaMocks.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { stripeSessionId: 'cs_dep_123' },
    })
  })

  it('normalizes legacy retainer descriptions in Stripe product names', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ description: 'Retainer – 2026 Engagement Letter' }),
    )

    await createDepositCheckoutSession('tok_abc')

    expect(stripeMocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              product_data: { name: 'Initial payment - 2026 Engagement Letter' },
            }),
          }),
        ],
      }),
    )
  })

  it('throws STRIPE_MISSING_URL when Stripe returns no URL', async () => {
    stripeMocks.sessionsCreate.mockResolvedValue({ id: 'cs_dep_123', url: null })

    await expect(createDepositCheckoutSession('tok_abc')).rejects.toBeInstanceOf(
      DepositCheckoutError,
    )
    expect(prismaMocks.payment.update).not.toHaveBeenCalled()
  })
})

describe('markDepositPaymentPaid', () => {
  const eventAt = new Date('2026-06-07T12:00:00Z')

  function stripeSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
    return {
      id: 'cs_dep_123',
      payment_intent: 'pi_123',
      metadata: { payToken: 'tok_abc' },
      ...overrides,
    } as unknown as Stripe.Checkout.Session
  }

  it('ignores sessions without a payToken in metadata', async () => {
    await markDepositPaymentPaid(stripeSession({ metadata: {} }), eventAt)

    expect(prismaMocks.payment.findUnique).not.toHaveBeenCalled()
    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
  })

  it('ignores unknown payTokens (no Payment row)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    prismaMocks.payment.findUnique.mockResolvedValue(null)

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
    expect(notifyMocks.smsOptedInAdmins).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('marks PAID, syncs the agreement, and notifies admins + signer', async () => {
    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(prismaMocks.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay_1', status: { notIn: ['PAID', 'REFUNDED'] } },
      data: {
        status: 'PAID',
        paidAt: eventAt,
        stripeSessionId: 'cs_dep_123',
        stripePaymentIntentId: 'pi_123',
      },
    })
    expect(prismaMocks.agreement.updateMany).toHaveBeenCalledWith({
      where: { id: 'agr_1', depositStatus: { not: 'PAID' } },
      data: { depositStatus: 'PAID', depositPaidAt: eventAt },
    })
    expect(notifyMocks.smsOptedInAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        toggle: 'notifyOnClientPayment',
        message: expect.stringContaining('Anna Nguyen paid $300.00'),
      }),
    )
    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
      { signerId: 'lead_1', signerKind: 'lead', organizationId: 'org_1', sentById: 'staff_1' },
      'Hi Anna, we received your initial payment. Thank you!',
      'deposit_receipt',
    )
  })

  it('does nothing on duplicate webhook delivery (claim count 0)', async () => {
    prismaMocks.payment.updateMany.mockResolvedValue({ count: 0 })

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(prismaMocks.agreement.updateMany).not.toHaveBeenCalled()
    expect(notifyMocks.smsOptedInAdmins).not.toHaveBeenCalled()
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })

  it('still sends the client receipt when admin notification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    notifyMocks.smsOptedInAdmins.mockRejectedValue(new Error('twilio down'))

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })

  it('still notifies when the agreement deposit sync fails (isolated step)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    prismaMocks.agreement.updateMany.mockRejectedValue(new Error('db hiccup'))

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(notifyMocks.smsOptedInAdmins).toHaveBeenCalledTimes(1)
    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })

  it('skips the receipt SMS gracefully when the agreement was deleted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ agreementId: null, agreement: null }),
    )

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(prismaMocks.agreement.updateMany).not.toHaveBeenCalled()
    expect(notifyMocks.smsOptedInAdmins).toHaveBeenCalledTimes(1)
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('skips the receipt SMS when the signer shares a phone with a notified admin', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // Signer's phone == the admin phone that just received the paid-notification.
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({
        lead: {
          id: 'lead_1',
          firstName: 'Anna',
          lastName: 'Nguyen',
          email: 'anna@test.com',
          phone: '+18136442540',
        },
      }),
    )
    notifyMocks.smsOptedInAdmins.mockResolvedValue(['+18136442540'])

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(notifyMocks.smsOptedInAdmins).toHaveBeenCalledTimes(1)
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('still sends the receipt when the signer phone differs from notified admins', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({
        lead: {
          id: 'lead_1',
          firstName: 'Anna',
          lastName: 'Nguyen',
          email: 'anna@test.com',
          phone: '+15559990000',
        },
      }),
    )
    notifyMocks.smsOptedInAdmins.mockResolvedValue(['+18136442540'])

    await markDepositPaymentPaid(stripeSession(), eventAt)

    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledTimes(1)
  })
})

describe('reconcileDepositPaymentFromStripe', () => {
  function paidSession(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cs_dep_123',
      payment_status: 'paid',
      payment_intent: { id: 'pi_123', created: 1_750_000_000 },
      metadata: { payToken: 'tok_abc' },
      ...overrides,
    }
  }

  it('marks PAID when the Stripe session reports paid (webhook self-heal)', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ stripeSessionId: 'cs_dep_123' }),
    )
    stripeMocks.sessionsRetrieve.mockResolvedValue(paidSession())

    await reconcileDepositPaymentFromStripe('tok_abc')

    expect(stripeMocks.sessionsRetrieve).toHaveBeenCalledWith('cs_dep_123', {
      expand: ['payment_intent'],
    })
    expect(prismaMocks.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    )
  })

  it('skips the Stripe round-trip when no checkout session exists yet', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(paymentRow({ stripeSessionId: null }))

    await reconcileDepositPaymentFromStripe('tok_abc')

    expect(stripeMocks.sessionsRetrieve).not.toHaveBeenCalled()
    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
  })

  it.each(['PAID', 'REFUNDED', 'CANCELED'])(
    'skips reconcile for a terminal %s payment',
    async (status) => {
      prismaMocks.payment.findUnique.mockResolvedValue(
        paymentRow({ status, stripeSessionId: 'cs_dep_123' }),
      )

      await reconcileDepositPaymentFromStripe('tok_abc')

      expect(stripeMocks.sessionsRetrieve).not.toHaveBeenCalled()
    },
  )

  it('does not mark PAID when the session is still unpaid', async () => {
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ stripeSessionId: 'cs_dep_123' }),
    )
    stripeMocks.sessionsRetrieve.mockResolvedValue(paidSession({ payment_status: 'unpaid' }))

    await reconcileDepositPaymentFromStripe('tok_abc')

    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
  })

  it('swallows Stripe errors so the webhook can still fulfill later', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    prismaMocks.payment.findUnique.mockResolvedValue(
      paymentRow({ stripeSessionId: 'cs_dep_123' }),
    )
    stripeMocks.sessionsRetrieve.mockRejectedValue(new Error('stripe down'))

    await expect(reconcileDepositPaymentFromStripe('tok_abc')).resolves.toBeUndefined()
    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
