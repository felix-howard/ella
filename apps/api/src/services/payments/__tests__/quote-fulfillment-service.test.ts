import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SendableQuote } from '../quote-fulfillment-types'

const dbMocks = vi.hoisted(() => {
  const tx = {
    client: { findFirst: vi.fn(), create: vi.fn() },
    taxEngagement: { create: vi.fn() },
    taxCase: { create: vi.fn() },
    conversation: { create: vi.fn() },
    message: { findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    agreement: { updateMany: vi.fn() },
    action: { updateMany: vi.fn() },
    lead: { update: vi.fn() },
    paymentQuote: { updateMany: vi.fn() },
    stripeCheckoutSession: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  }
  return {
    tx,
    prisma: {
      paymentQuote: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
      payment: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  }
})

const stripeMocks = vi.hoisted(() => ({
  paymentIntentsRetrieve: vi.fn(),
}))

const notifyMocks = vi.hoisted(() => ({
  notifyDuplicateQuotePayment: vi.fn(),
  notifyFirstQuotePayment: vi.fn(),
  notifyQuotePaymentFailed: vi.fn(),
}))

const stripeCustomerMocks = vi.hoisted(() => ({
  linkClientToStripeCustomerIfMissing: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    paymentIntents = { retrieve: stripeMocks.paymentIntentsRetrieve }
  },
}))

vi.mock('../../../lib/config', () => ({
  config: { stripe: { secretKey: 'sk_test_mock', isConfigured: true } },
}))

vi.mock('../../../lib/db', () => ({ prisma: dbMocks.prisma }))
vi.mock('../../stripe/stripe-customer-link-service', () => stripeCustomerMocks)
vi.mock('../quote-fulfillment-notify', () => notifyMocks)

import { fulfillFirstQuotePayment } from '../quote-fulfillment-service'

const eventAt = new Date('2026-06-07T12:00:00Z')

function quoteRow(overrides: Partial<SendableQuote> = {}): SendableQuote {
  return {
    id: 'quote_1',
    organizationId: 'org_1',
    clientId: null,
    leadId: 'lead_1',
    payToken: 'tok_quote',
    sentByStaffId: 'staff_1',
    monthlyTotalCents: 8500,
    setupTotalCents: 1500,
    client: null,
    lead: {
      id: 'lead_1',
      firstName: 'Anna',
      lastName: 'Nguyen',
      phone: '+18135550123',
      email: 'anna@test.com',
      tags: [],
      notes: null,
      status: 'NEW',
      convertedToId: null,
      messagesLastReadAt: null,
    },
    ...overrides,
  } as SendableQuote
}

function checkoutSession(): Stripe.Checkout.Session {
  return {
    id: 'cs_quote_123',
    payment_intent: 'pi_quote_123',
  } as unknown as Stripe.Checkout.Session
}

describe('fulfillFirstQuotePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === 'function') return callback(dbMocks.tx)
      return Promise.all(callback as Promise<unknown>[])
    })
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValue(quoteRow())
    dbMocks.tx.client.findFirst.mockResolvedValue(null)
    dbMocks.tx.client.create.mockResolvedValue({
      id: 'client_new',
      firstName: 'Anna',
      lastName: 'Nguyen',
      phone: '+18135550123',
    })
    dbMocks.tx.taxEngagement.create.mockResolvedValue({ id: 'eng_1' })
    dbMocks.tx.taxCase.create.mockResolvedValue({ id: 'case_1' })
    dbMocks.tx.conversation.create.mockResolvedValue({ id: 'conv_1' })
    dbMocks.tx.message.findFirst.mockResolvedValue({ createdAt: new Date('2026-06-07T12:00:00Z') })
    dbMocks.tx.message.count.mockResolvedValue(0)
    dbMocks.tx.message.updateMany.mockResolvedValue({ count: 0 })
    dbMocks.tx.agreement.updateMany.mockResolvedValue({ count: 1 })
    dbMocks.tx.action.updateMany.mockResolvedValue({ count: 1 })
    dbMocks.tx.lead.update.mockResolvedValue({})
    dbMocks.tx.paymentQuote.updateMany.mockResolvedValue({ count: 1 })
    dbMocks.tx.stripeCheckoutSession.findMany.mockResolvedValue([
      { stripeSessionId: 'cs_quote_123' },
    ])
    dbMocks.tx.stripeCheckoutSession.findFirst.mockResolvedValue(null)
    dbMocks.tx.stripeCheckoutSession.updateMany.mockResolvedValue({ count: 1 })
    dbMocks.tx.payment.findFirst.mockResolvedValue(null)
    dbMocks.tx.payment.create.mockResolvedValue({})
    dbMocks.tx.$executeRaw.mockResolvedValue(0)
    dbMocks.tx.$queryRaw.mockResolvedValue([])
    dbMocks.prisma.payment.create.mockResolvedValue({})
    stripeMocks.paymentIntentsRetrieve.mockResolvedValue({
      id: 'pi_quote_123',
      customer: 'cus_123',
      latest_charge: {
        id: 'ch_123',
        customer: 'cus_123',
        payment_intent: 'pi_quote_123',
        receipt_url: 'https://pay.stripe.com/receipts/ch_123',
        receipt_number: 'R-123',
        payment_method_details: { card: { brand: 'visa', last4: '4242' } },
      },
    })
    notifyMocks.notifyFirstQuotePayment.mockResolvedValue(undefined)
    notifyMocks.notifyDuplicateQuotePayment.mockResolvedValue(undefined)
    stripeCustomerMocks.linkClientToStripeCustomerIfMissing.mockResolvedValue(undefined)
  })

  it('creates the first quote payment in the same transaction as lead conversion', async () => {
    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
    })

    expect(dbMocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function))
    expect(dbMocks.tx.client.create).toHaveBeenCalledTimes(1)
    expect(dbMocks.tx.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote_1', clientId: null },
      data: { clientId: 'client_new' },
    })
    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_new',
        leadId: null,
        type: 'OTHER',
        status: 'PAID',
        amount: '100.00',
        payToken: 'qf_cs_quote_123',
        stripePaymentIntentId: 'pi_quote_123',
        stripeCustomerId: 'cus_123',
        stripeChargeId: 'ch_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/ch_123',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
        receiptSyncedAt: eventAt,
      }),
    })
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
    expect(stripeCustomerMocks.linkClientToStripeCustomerIfMissing).toHaveBeenCalledWith({
      clientId: 'client_new',
      organizationId: 'org_1',
      stripeCustomerId: 'cus_123',
    })
    expect(notifyMocks.notifyFirstQuotePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        signer: expect.objectContaining({ id: 'client_new', kind: 'client' }),
        amountFormatted: '$100.00',
      }),
    )
  })

  it('does not notify when the transaction-scoped payment insert is a duplicate', async () => {
    dbMocks.tx.payment.create.mockRejectedValueOnce({ code: 'P2002' })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
    })

    expect(dbMocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function))
    expect(dbMocks.tx.client.create).toHaveBeenCalledTimes(1)
    expect(dbMocks.tx.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote_1', clientId: null },
      data: { clientId: 'client_new' },
    })
    expect(dbMocks.tx.payment.create).toHaveBeenCalledTimes(1)
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
    expect(notifyMocks.notifyFirstQuotePayment).not.toHaveBeenCalled()
    expect(stripeCustomerMocks.linkClientToStripeCustomerIfMissing).not.toHaveBeenCalled()
  })

  it('flags a second successful quote checkout for staff review without a client receipt', async () => {
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({
        clientId: 'client_existing',
        client: {
          id: 'client_existing',
          firstName: 'Anna',
          lastName: 'Nguyen',
          phone: '+18135550123',
        },
      }),
    )
    dbMocks.tx.stripeCheckoutSession.findMany.mockResolvedValueOnce([
      { stripeSessionId: 'cs_first_success' },
      { stripeSessionId: 'cs_quote_123' },
    ])
    dbMocks.tx.payment.findFirst.mockResolvedValueOnce({
      payToken: 'qf_cs_first_success',
      stripeSessionId: 'cs_first_success',
      stripePaymentIntentId: 'pi_first_success',
    })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
      stripeEventId: 'evt_async_payment_succeeded',
    })

    expect(dbMocks.tx.client.create).not.toHaveBeenCalled()
    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
    expect(dbMocks.tx.stripeCheckoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        paymentQuoteId: 'quote_1',
        stripeSessionId: 'cs_quote_123',
        status: { not: 'duplicate_paid_review' },
      },
      data: {
        status: 'duplicate_paid_review',
        lastStripeEventAt: eventAt,
        lastStripeEventId: 'evt_async_payment_succeeded',
      },
    })
    expect(notifyMocks.notifyFirstQuotePayment).not.toHaveBeenCalled()
    expect(notifyMocks.notifyDuplicateQuotePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        signer: expect.objectContaining({ id: 'client_existing', kind: 'client' }),
        amountFormatted: '$100.00',
        stripeSessionId: 'cs_quote_123',
        stripePaymentIntentId: 'pi_quote_123',
      }),
    )
    expect(stripeCustomerMocks.linkClientToStripeCustomerIfMissing).not.toHaveBeenCalled()
  })

  it('fails duplicate fulfillment when no checkout session can be marked for audit', async () => {
    dbMocks.tx.stripeCheckoutSession.findMany.mockResolvedValueOnce([
      { stripeSessionId: 'cs_first_success' },
      { stripeSessionId: 'cs_quote_123' },
    ])
    dbMocks.tx.payment.findFirst.mockResolvedValueOnce({
      payToken: 'qf_cs_first_success',
      stripeSessionId: 'cs_first_success',
    })
    dbMocks.tx.stripeCheckoutSession.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMocks.tx.stripeCheckoutSession.findFirst.mockResolvedValueOnce(null)

    await expect(
      fulfillFirstQuotePayment({
        quoteId: 'quote_1',
        session: checkoutSession(),
        eventAt,
        stripeEventId: 'evt_async_payment_succeeded',
      }),
    ).rejects.toThrow('could not be marked for review')

    expect(notifyMocks.notifyDuplicateQuotePayment).not.toHaveBeenCalled()
  })

  it('does not repeat duplicate alerts when the checkout session is already marked', async () => {
    dbMocks.tx.stripeCheckoutSession.findMany.mockResolvedValueOnce([
      { stripeSessionId: 'cs_first_success' },
      { stripeSessionId: 'cs_quote_123' },
    ])
    dbMocks.tx.payment.findFirst.mockResolvedValueOnce({
      payToken: 'qf_cs_first_success',
      stripeSessionId: 'cs_first_success',
    })
    dbMocks.tx.stripeCheckoutSession.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMocks.tx.stripeCheckoutSession.findFirst.mockResolvedValueOnce({
      status: 'duplicate_paid_review',
    })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
      stripeEventId: 'evt_async_payment_succeeded',
    })

    expect(notifyMocks.notifyDuplicateQuotePayment).not.toHaveBeenCalled()
  })
})
