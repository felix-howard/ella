import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stripeWebhookRoute } from '../stripe'

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    updateMany: vi.fn(),
    // Recurring fulfillment loads the sendable quote by subscription on
    // invoice.* events; default to "no sendable quote" so notify is skipped.
    findFirst: vi.fn(),
  },
  stripeCheckoutSession: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  stripeWebhookEventLog: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  payment: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    webhooks = {
      constructEvent: stripeMocks.constructEvent,
    }
  },
}))

// Spread the real config so transitively imported modules (lib/constants,
// services pulled in via the deposit-payment webhook path) keep their
// defaults; only Stripe keys are overridden for signature verification.
vi.mock('../../../lib/config', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    config: { stripe: Record<string, unknown> } & Record<string, unknown>
  }
  return {
    config: {
      ...actual.config,
      stripe: {
        ...actual.config.stripe,
        secretKey: 'sk_test_mock',
        webhookSecret: 'whsec_test_mock',
      },
    },
  }
})

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

function createApp() {
  const app = new Hono()
  app.route('/webhooks/stripe', stripeWebhookRoute)
  return app
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: `evt_${type.replaceAll('.', '_')}`,
    type,
    created: 1_800_000_000,
    data: { object },
  }
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    customer: 'cus_123',
    subscription: 'sub_123',
    payment_intent: null,
    metadata: { paymentQuoteId: 'quote_123' },
    ...overrides,
  }
}

async function postStripeWebhook() {
  const app = createApp()
  return app.request('/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': 't=1800000000,v1=signature',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id: 'evt_test' }),
  })
}

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stripeMocks.constructEvent.mockReturnValue(
      stripeEvent('checkout.session.completed', checkoutSession())
    )
    prismaMocks.stripeCheckoutSession.findUnique.mockResolvedValue({
      paymentQuoteId: 'quote_123',
      status: 'open',
      paidAt: null,
      lastStripeEventAt: null,
      paymentQuote: { status: 'checkout_created' },
    })
    prismaMocks.stripeCheckoutSession.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.paymentQuote.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.paymentQuote.findFirst.mockResolvedValue(null)
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue(null)
    prismaMocks.stripeWebhookEventLog.create.mockResolvedValue({
      stripeEventId: 'evt_checkout_session_completed',
      status: 'received',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.update.mockResolvedValue({
      stripeEventId: 'evt_checkout_session_completed',
      status: 'processed',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.payment.create.mockResolvedValue({})
    prismaMocks.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations)
    )
  })

  it('marks a completed paid subscription checkout quote active', async () => {
    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      received: true,
      processed: true,
      type: 'checkout.session.completed',
    })
    expect(stripeMocks.constructEvent).toHaveBeenCalledWith(
      JSON.stringify({ id: 'evt_test' }),
      't=1800000000,v1=signature',
      'whsec_test_mock'
    )
    expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        stripeSessionId: 'cs_test_123',
        OR: [
          { lastStripeEventAt: null },
          { lastStripeEventAt: { lt: new Date(1_800_000_000 * 1000) } },
          {
            AND: [
              { lastStripeEventAt: new Date(1_800_000_000 * 1000) },
              { status: { in: ['created', 'open', 'complete', 'expired'] } },
            ],
          },
        ],
      },
      data: expect.objectContaining({
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePaymentIntentId: null,
        status: 'complete',
        lastStripeEventId: 'evt_checkout_session_completed',
        lastStripeEventAt: new Date(1_800_000_000 * 1000),
        paidAt: new Date(1_800_000_000 * 1000),
      }),
    })
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'quote_123',
        status: { not: 'canceled' },
        OR: [
          { lastStripeEventAt: null },
          { lastStripeEventAt: { lt: new Date(1_800_000_000 * 1000) } },
          {
            AND: [
              { lastStripeEventAt: new Date(1_800_000_000 * 1000) },
              {
                status: {
                  in: [
                    'pending_checkout',
                    'checkout_created',
                    'stripe_create_failed',
                    'checkout_persist_failed',
                    'stripe_missing_url',
                    'awaiting_payment',
                    'paid',
                    'active',
                  ],
                },
              },
            ],
          },
        ],
      },
      data: {
        status: 'active',
        lastStripeEventId: 'evt_checkout_session_completed',
        lastStripeEventAt: new Date(1_800_000_000 * 1000),
      },
    })
  })

  it('keeps a completed delayed-payment checkout awaiting payment', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('checkout.session.completed', checkoutSession({ payment_status: 'unpaid' }))
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ stripeSessionId: 'cs_test_123' }),
      data: expect.objectContaining({
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePaymentIntentId: null,
        status: 'complete',
      }),
    })
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'quote_123',
        status: { not: 'canceled' },
      }),
      data: expect.objectContaining({ status: 'awaiting_payment' }),
    })
  })

  it('prefers the local checkout-session quote association over metadata', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent(
        'checkout.session.completed',
        checkoutSession({ metadata: { paymentQuoteId: 'quote_wrong' } })
      )
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'quote_123',
        status: { not: 'canceled' },
      }),
      data: expect.objectContaining({ status: 'active' }),
    })
    expect(warnSpy).toHaveBeenCalledWith(
      '[StripeWebhook] Ignoring mismatched checkout metadata quote id',
      {
        stripeSessionId: 'cs_test_123',
        paymentQuoteId: 'quote_123',
      }
    )
    warnSpy.mockRestore()
  })

  it('marks one-time async success checkout quote paid', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent(
        'checkout.session.async_payment_succeeded',
        checkoutSession({
          mode: 'payment',
          subscription: null,
          payment_intent: 'pi_123',
        })
      )
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ stripeSessionId: 'cs_test_123' }),
      data: expect.objectContaining({
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,
        stripePaymentIntentId: 'pi_123',
        status: 'complete',
        paidAt: new Date(1_800_000_000 * 1000),
      }),
    })
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'quote_123',
        status: { not: 'canceled' },
      }),
      data: expect.objectContaining({ status: 'paid' }),
    })
  })

  it('settles a custom-link one-time checkout (source-agnostic routing)', async () => {
    // Custom links carry the same metadata.paymentQuoteId the webhook routes on,
    // plus a source tag the webhook ignores — so fulfillment is byte-identical.
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent(
        'checkout.session.completed',
        checkoutSession({
          mode: 'payment',
          subscription: null,
          payment_intent: 'pi_custom',
          metadata: { paymentQuoteId: 'quote_custom', source: 'custom_link' },
        })
      )
    )
    prismaMocks.stripeCheckoutSession.findUnique.mockResolvedValueOnce({
      paymentQuoteId: 'quote_custom',
      status: 'open',
      paidAt: null,
      lastStripeEventAt: null,
      paymentQuote: { status: 'checkout_created' },
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'quote_custom', status: { not: 'canceled' } }),
      data: expect.objectContaining({ status: 'paid' }),
    })
  })

  it('marks async payment failures on the quote and checkout session', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('checkout.session.async_payment_failed', checkoutSession())
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ stripeSessionId: 'cs_test_123' }),
      data: expect.objectContaining({
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        stripePaymentIntentId: null,
        status: 'payment_failed',
      }),
    })
    expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'quote_123',
        status: { not: 'canceled' },
      }),
      data: expect.objectContaining({ status: 'payment_failed' }),
    })
  })

  it.each([
    ['invoice.paid', { object: 'invoice', subscription: 'sub_123' }, 'invoice_paid', 'active'],
    [
      'invoice.payment_failed',
      { object: 'invoice', subscription: 'sub_123' },
      'invoice_payment_failed',
      'payment_failed',
    ],
    [
      'customer.subscription.deleted',
      { object: 'subscription', id: 'sub_123' },
      'subscription_canceled',
      'canceled',
    ],
  ])(
    'maps %s to local subscription status updates',
    async (type, object, sessionStatus, quoteStatus) => {
      stripeMocks.constructEvent.mockReturnValueOnce(stripeEvent(type, object))

      const res = await postStripeWebhook()

      expect(res.status).toBe(200)
      expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ stripeSubscriptionId: 'sub_123' }),
        data: expect.objectContaining({
          status: sessionStatus,
          lastStripeEventAt: new Date(1_800_000_000 * 1000),
        }),
      })
      expect(prismaMocks.paymentQuote.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: { not: 'canceled' },
          checkoutSessions: { some: { stripeSubscriptionId: 'sub_123' } },
        }),
        data: expect.objectContaining({
          status: quoteStatus,
          lastStripeEventAt: new Date(1_800_000_000 * 1000),
        }),
      })
    }
  )

  it('records recurring invoice payments with receipt facts', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('invoice.paid', {
        id: 'in_123',
        object: 'invoice',
        subscription: 'sub_123',
        billing_reason: 'subscription_cycle',
        amount_paid: 8500,
        amount_due: 8500,
        customer: 'cus_123',
        hosted_invoice_url: 'https://invoice.stripe.com/in_123',
        invoice_pdf: 'https://invoice.stripe.com/in_123.pdf',
        payments: {
          data: [
            {
              payment: {
                payment_intent: {
                  id: 'pi_inv_123',
                  latest_charge: {
                    id: 'ch_inv_123',
                    customer: 'cus_123',
                    payment_intent: 'pi_inv_123',
                    receipt_url: 'https://pay.stripe.com/receipts/ch_inv_123',
                    receipt_number: 'R-123',
                    payment_method_details: { card: { brand: 'visa', last4: '4242' } },
                  },
                },
              },
            },
          ],
        },
      })
    )
    prismaMocks.paymentQuote.findFirst.mockResolvedValueOnce({
      id: 'quote_123',
      organizationId: 'org_1',
      clientId: 'client_123',
      leadId: null,
      client: { id: 'client_123', firstName: 'Anna', lastName: 'Nguyen', phone: null },
      lead: null,
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_123',
        leadId: null,
        type: 'RECURRING',
        status: 'PAID',
        amount: '85.00',
        payToken: 'qf_pi_inv_123',
        stripePaymentIntentId: 'pi_inv_123',
        stripeCustomerId: 'cus_123',
        stripeInvoiceId: 'in_123',
        stripeChargeId: 'ch_inv_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/ch_inv_123',
        stripeReceiptNumber: 'R-123',
        stripeHostedInvoiceUrl: 'https://invoice.stripe.com/in_123',
        stripeInvoicePdfUrl: 'https://invoice.stripe.com/in_123.pdf',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
        receiptSyncedAt: expect.any(Date),
      }),
    })
  })

  it('returns 500 when recurring Payment insert fails with a non-idempotency error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('invoice.paid', {
        object: 'invoice',
        subscription: 'sub_123',
        billing_reason: 'subscription_cycle',
        amount_paid: 8500,
        amount_due: 8500,
        customer: 'cus_123',
        payments: {
          data: [
            {
              payment: {
                type: 'payment_intent',
                payment_intent: 'pi_inv_123',
              },
            },
          ],
        },
      })
    )
    prismaMocks.paymentQuote.findFirst.mockResolvedValueOnce({
      id: 'quote_123',
      organizationId: 'org_1',
      clientId: 'client_123',
      leadId: null,
      client: { id: 'client_123', firstName: 'Anna', lastName: 'Nguyen', phone: null },
      lead: null,
    })
    prismaMocks.payment.create.mockRejectedValueOnce(new Error('insert failed'))

    const res = await postStripeWebhook()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Processing failed' })
    expect(prismaMocks.payment.create).toHaveBeenCalled()
    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: {
        stripeEventId: 'evt_invoice_paid',
        status: { not: 'processed' },
      },
      data: expect.objectContaining({
        status: 'failed',
        errorMessage: 'Error: insert failed',
        processedAt: null,
      }),
    })
    errorSpy.mockRestore()
  })

  it('returns 400 when the Stripe signature is missing', async () => {
    const app = createApp()
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_missing_signature' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing Stripe signature' })
    expect(stripeMocks.constructEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when Stripe signature verification fails', async () => {
    stripeMocks.constructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature')
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid Stripe webhook' })
    expect(prismaMocks.stripeCheckoutSession.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
  })

  it('returns 500 when durable handling fails after verification', async () => {
    prismaMocks.$transaction.mockRejectedValueOnce(new Error('DB down'))

    const res = await postStripeWebhook()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Processing failed' })
  })

  it('skips stale checkout events after a newer subscription status update', async () => {
    prismaMocks.stripeCheckoutSession.findUnique.mockResolvedValueOnce({
      paymentQuoteId: 'quote_123',
      status: 'invoice_payment_failed',
      paidAt: null,
      lastStripeEventAt: new Date(1_800_000_100 * 1000),
      paymentQuote: { status: 'payment_failed' },
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()
  })

  it('does not let late checkout completion replace a payment failure', async () => {
    prismaMocks.stripeCheckoutSession.findUnique.mockResolvedValueOnce({
      paymentQuoteId: 'quote_123',
      status: 'payment_failed',
      paidAt: null,
      lastStripeEventAt: new Date(1_800_000_000 * 1000),
      paymentQuote: { status: 'payment_failed' },
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()
  })

  it('guards same-second checkout completion writes against payment failure state', async () => {
    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    const sessionWhere = prismaMocks.stripeCheckoutSession.updateMany.mock.calls[0]?.[0].where
    const quoteWhere = prismaMocks.paymentQuote.updateMany.mock.calls[0]?.[0].where
    const sessionSameSecondStatuses = sessionWhere.OR[2].AND[1].status.in
    const quoteSameSecondStatuses = quoteWhere.OR[2].AND[1].status.in

    expect(sessionSameSecondStatuses).not.toContain('payment_failed')
    expect(sessionSameSecondStatuses).not.toContain('invoice_payment_failed')
    expect(sessionSameSecondStatuses).not.toContain('subscription_canceled')
    expect(quoteSameSecondStatuses).not.toContain('payment_failed')
    expect(quoteSameSecondStatuses).not.toContain('canceled')
  })

  it('guards same-second invoice paid writes against failed subscription state', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('invoice.paid', { object: 'invoice', subscription: 'sub_123' })
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    const sessionWhere = prismaMocks.stripeCheckoutSession.updateMany.mock.calls[0]?.[0].where
    const quoteWhere = prismaMocks.paymentQuote.updateMany.mock.calls[0]?.[0].where
    const sessionSameSecondStatuses = sessionWhere.OR[2].AND[1].status.in
    const quoteSameSecondStatuses = quoteWhere.OR[2].AND[1].status.in

    expect(sessionSameSecondStatuses).not.toContain('payment_failed')
    expect(sessionSameSecondStatuses).not.toContain('invoice_payment_failed')
    expect(sessionSameSecondStatuses).not.toContain('subscription_canceled')
    expect(quoteSameSecondStatuses).not.toContain('payment_failed')
    expect(quoteSameSecondStatuses).not.toContain('canceled')
  })

  it('does not let later invoice events replace a canceled checkout session status', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent('invoice.paid', { object: 'invoice', subscription: 'sub_123' })
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        stripeSubscriptionId: 'sub_123',
        status: { not: 'subscription_canceled' },
      }),
      data: expect.objectContaining({ status: 'invoice_paid' }),
    })
  })

  it('routes payToken checkout sessions to the deposit flow, not the quote flow', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent(
        'checkout.session.completed',
        checkoutSession({
          mode: 'payment',
          metadata: { payToken: 'tok_deposit_abc', paymentId: 'pay_1' },
        })
      )
    )
    // Unknown payToken → deposit handler logs and ignores, never touches quotes.
    prismaMocks.payment.findUnique.mockResolvedValueOnce(null)

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { payToken: 'tok_deposit_abc' } })
    )
    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.stripeCheckoutSession.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('defers unpaid deposit checkout completion to the async-success event', async () => {
    stripeMocks.constructEvent.mockReturnValueOnce(
      stripeEvent(
        'checkout.session.completed',
        checkoutSession({
          mode: 'payment',
          payment_status: 'unpaid',
          metadata: { payToken: 'tok_deposit_abc' },
        })
      )
    )

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    // Fulfillment waits for checkout.session.async_payment_succeeded.
    expect(prismaMocks.payment.findUnique).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
  })

  it('skips duplicate completed checkout events', async () => {
    prismaMocks.stripeCheckoutSession.findUnique.mockResolvedValueOnce({
      paymentQuoteId: 'quote_123',
      status: 'complete',
      paidAt: new Date(1_800_000_000 * 1000),
      lastStripeEventAt: new Date(1_800_000_000 * 1000),
      paymentQuote: { status: 'active' },
    })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()
  })

  it('returns 200 for already processed Stripe event duplicates without side effects', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue({
      stripeEventId: 'evt_checkout_session_completed',
      status: 'processed',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      received: true,
      processed: false,
      duplicate: true,
      type: 'checkout.session.completed',
    })
    expect(prismaMocks.stripeWebhookEventLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_checkout_session_completed' },
        data: expect.objectContaining({ attemptCount: { increment: 1 } }),
      })
    )
    expect(prismaMocks.stripeCheckoutSession.findUnique).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
  })

  it('retries a previously failed Stripe event and marks it processed on success', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique
      .mockResolvedValueOnce({
        stripeEventId: 'evt_checkout_session_completed',
        status: 'failed',
        attemptCount: 1,
      })
      .mockResolvedValueOnce({
        stripeEventId: 'evt_checkout_session_completed',
        status: 'failed',
        attemptCount: 1,
      })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeCheckoutSession.findUnique).toHaveBeenCalled()
    expect(prismaMocks.stripeWebhookEventLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_checkout_session_completed' },
        data: expect.objectContaining({
          attemptCount: { increment: 1 },
        }),
      })
    )
    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: {
        stripeEventId: 'evt_checkout_session_completed',
        OR: [
          { status: { in: ['received', 'failed'] } },
          { status: 'processing', updatedAt: { lt: expect.any(Date) } },
        ],
      },
      data: {
        status: 'processing',
        errorMessage: null,
        processedAt: null,
      },
    })
    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_checkout_session_completed' },
      data: expect.objectContaining({
        status: 'processed',
        errorMessage: null,
        processedAt: expect.any(Date),
      }),
    })
  })

  it('returns a retryable response for fresh in-flight processing collisions', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue({
      stripeEventId: 'evt_checkout_session_completed',
      status: 'processing',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await postStripeWebhook()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'Webhook already processing',
      received: true,
      processed: false,
      type: 'checkout.session.completed',
    })
    expect(prismaMocks.stripeCheckoutSession.findUnique).not.toHaveBeenCalled()
    expect(prismaMocks.paymentQuote.updateMany).not.toHaveBeenCalled()
  })

  it('reclaims stale processing webhook events instead of retrying forever', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue({
      stripeEventId: 'evt_checkout_session_completed',
      status: 'processing',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.updateMany.mockResolvedValueOnce({ count: 1 })

    const res = await postStripeWebhook()

    expect(res.status).toBe(200)
    expect(prismaMocks.stripeWebhookEventLog.update).not.toHaveBeenCalled()
    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: {
        stripeEventId: 'evt_checkout_session_completed',
        OR: [
          { status: { in: ['received', 'failed'] } },
          { status: 'processing', updatedAt: { lt: expect.any(Date) } },
        ],
      },
      data: {
        status: 'processing',
        errorMessage: null,
        processedAt: null,
      },
    })
    expect(prismaMocks.stripeCheckoutSession.findUnique).toHaveBeenCalled()
  })
})
