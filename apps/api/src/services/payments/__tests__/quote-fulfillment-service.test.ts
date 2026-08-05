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
    paymentQuote: { findFirst: vi.fn(), updateMany: vi.fn() },
    stripeCheckoutSession: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    stripeWebhookEventLog: { findFirst: vi.fn() },
    payment: { create: vi.fn(), findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  }
  return {
    tx,
    prisma: {
      paymentQuote: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
      payment: { create: vi.fn(), findUnique: vi.fn() },
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
  notifyRecurringQuotePayment: vi.fn(),
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

import {
  fulfillFirstQuotePayment,
  recordRecurringQuotePayment,
} from '../quote-fulfillment-service'

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
      organizationId: 'org_1',
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

function checkoutSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_quote_123',
    payment_intent: 'pi_quote_123',
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

describe('quote fulfillment service', () => {
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
    dbMocks.tx.stripeWebhookEventLog.findFirst.mockResolvedValue(null)
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
      where: { id: 'quote_1', organizationId: 'org_1', clientId: null },
      data: { clientId: 'client_new' },
    })
    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentQuoteId: 'quote_1',
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
      where: { id: 'quote_1', organizationId: 'org_1', clientId: null },
      data: { clientId: 'client_new' },
    })
    expect(dbMocks.tx.payment.create).toHaveBeenCalledTimes(1)
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
    expect(notifyMocks.notifyFirstQuotePayment).not.toHaveBeenCalled()
    expect(stripeCustomerMocks.linkClientToStripeCustomerIfMissing).not.toHaveBeenCalled()
  })

  it('links only the settled signed calculator agreement when the lead phone already belongs to a client', async () => {
    dbMocks.tx.client.findFirst.mockResolvedValueOnce({
      id: 'client_existing',
      firstName: 'Anna',
      lastName: 'Nguyen',
    })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
    })

    expect(dbMocks.tx.client.create).not.toHaveBeenCalled()
    expect(dbMocks.tx.agreement.updateMany).toHaveBeenCalledTimes(1)
    expect(dbMocks.tx.agreement.updateMany).toHaveBeenCalledWith({
      where: {
        paymentQuoteId: 'quote_1',
        organizationId: 'org_1',
        leadId: 'lead_1',
        clientId: null,
        status: 'SIGNED',
        source: 'CALCULATOR',
        type: 'ENGAGEMENT_LETTER',
      },
      data: { clientId: 'client_existing' },
    })
    expect(dbMocks.tx.paymentQuote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote_1', organizationId: 'org_1', clientId: null },
      data: { clientId: 'client_existing' },
    })
    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentQuoteId: 'quote_1',
        clientId: 'client_existing',
        leadId: null,
      }),
    })
  })

  it('self-heals the quote-linked agreement on an idempotent retry of an older settlement', async () => {
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({
        clientId: 'client_existing',
        client: {
          id: 'client_existing',
          organizationId: 'org_1',
          firstName: 'Anna',
          lastName: 'Nguyen',
          phone: '+18135550123',
        },
      }),
    )
    dbMocks.tx.payment.findFirst.mockResolvedValueOnce({
      payToken: 'qf_cs_quote_123',
      stripeSessionId: 'cs_quote_123',
    })
    dbMocks.tx.agreement.updateMany.mockResolvedValueOnce({ count: 0 })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
    })

    expect(dbMocks.tx.agreement.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        paymentQuoteId: 'quote_1',
        organizationId: 'org_1',
        leadId: 'lead_1',
        clientId: null,
      }),
      data: { clientId: 'client_existing' },
    })
    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
    expect(notifyMocks.notifyFirstQuotePayment).not.toHaveBeenCalled()
  })

  it('stores and reports the authoritative post-discount Stripe settlement amount', async () => {
    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession({ amount_total: 7_250 }),
      eventAt,
    })

    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: '72.50' }),
    })
    expect(notifyMocks.notifyFirstQuotePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountFormatted: '$72.50' }),
    )
  })

  it('creates an already-refunded row when the refund webhook won the race', async () => {
    dbMocks.tx.stripeWebhookEventLog.findFirst.mockResolvedValueOnce({ id: 'event_log_1' })

    await fulfillFirstQuotePayment({
      quoteId: 'quote_1',
      session: checkoutSession(),
      eventAt,
    })

    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'REFUNDED' }),
    })
    expect(notifyMocks.notifyFirstQuotePayment).not.toHaveBeenCalled()
  })

  it('flags a second successful quote checkout for staff review without a client receipt', async () => {
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({
        clientId: 'client_existing',
        client: {
          id: 'client_existing',
          organizationId: 'org_1',
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
    expect(dbMocks.tx.payment.findFirst).toHaveBeenCalledWith({
      where: {
        paymentQuoteId: 'quote_1',
        status: { in: ['PAID', 'REFUNDED'] },
        type: 'OTHER',
        payToken: { startsWith: 'qf_' },
      },
      orderBy: { paidAt: 'asc' },
      select: {
        payToken: true,
        stripeSessionId: true,
      },
    })
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

  it('rejects a quote whose linked client belongs to another organization', async () => {
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({
        clientId: 'client_other_org',
        client: {
          id: 'client_other_org',
          organizationId: 'org_other',
          firstName: 'Anna',
          lastName: 'Nguyen',
          phone: '+18135550123',
        },
      }),
    )

    await expect(
      fulfillFirstQuotePayment({
        quoteId: 'quote_1',
        session: checkoutSession(),
        eventAt,
      }),
    ).rejects.toThrow('client organization mismatch')

    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
  })

  it('rejects a quote whose linked lead belongs to another organization', async () => {
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({ organizationId: 'org_other' }),
    )

    await expect(
      fulfillFirstQuotePayment({
        quoteId: 'quote_1',
        session: checkoutSession(),
        eventAt,
      }),
    ).rejects.toThrow('lead organization mismatch')

    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
  })

  it('rejects a converted client that cannot be resolved in the quote organization', async () => {
    const lead = quoteRow().lead!
    dbMocks.prisma.paymentQuote.findUnique.mockResolvedValueOnce(
      quoteRow({
        lead: {
          ...lead,
          status: 'CONVERTED',
          convertedToId: 'client_other_org',
        },
      }),
    )
    dbMocks.tx.client.findFirst.mockResolvedValueOnce(null)

    await expect(
      fulfillFirstQuotePayment({
        quoteId: 'quote_1',
        session: checkoutSession(),
        eventAt,
      }),
    ).rejects.toThrow('converted client scope mismatch')

    expect(dbMocks.tx.paymentQuote.updateMany).not.toHaveBeenCalled()
    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
  })

  it('fails closed when a converted lead cannot be repointed to the scoped client', async () => {
    dbMocks.tx.paymentQuote.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMocks.tx.paymentQuote.findFirst.mockResolvedValueOnce(null)

    await expect(
      fulfillFirstQuotePayment({
        quoteId: 'quote_1',
        session: checkoutSession(),
        eventAt,
      }),
    ).rejects.toThrow('client repoint scope mismatch')

    expect(dbMocks.tx.paymentQuote.findFirst).toHaveBeenCalledWith({
      where: { id: 'quote_1', organizationId: 'org_1', clientId: 'client_new' },
      select: { id: true },
    })
    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
    expect(dbMocks.prisma.payment.create).not.toHaveBeenCalled()
  })

  it('links recurring payments to the same quote', async () => {
    const quote = quoteRow({
      clientId: 'client_existing',
      leadId: null,
      client: {
        id: 'client_existing',
        organizationId: 'org_1',
        firstName: 'Anna',
        lastName: 'Nguyen',
        phone: '+18135550123',
      },
      lead: null,
    })

    await recordRecurringQuotePayment({
      quote,
      invoice: {
        id: 'in_cycle_1',
        billingReason: 'subscription_cycle',
        amountPaidCents: 8500,
        amountDueCents: 8500,
        paymentIntentId: 'pi_cycle_1',
        subscriptionId: 'sub_1',
      },
      eventAt,
    })

    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentQuoteId: 'quote_1',
        organizationId: 'org_1',
        clientId: 'client_existing',
        leadId: null,
        type: 'RECURRING',
        status: 'PAID',
        amount: '85.00',
        payToken: 'qf_pi_cycle_1',
      }),
    })
    expect(notifyMocks.notifyRecurringQuotePayment).toHaveBeenCalledWith({
      quote,
      signer: expect.objectContaining({
        id: 'client_existing',
        firstName: 'Anna',
        lastName: 'Nguyen',
        phone: '+18135550123',
        kind: 'client',
      }),
      amountFormatted: '$85.00',
    })
  })

  it('falls back to the frozen recurring total only when invoice amount_paid is absent', async () => {
    await recordRecurringQuotePayment({
      quote: quoteRow(),
      invoice: {
        id: 'in_cycle_fallback',
        billingReason: 'subscription_cycle',
        amountPaidCents: null,
        amountDueCents: 8500,
        paymentIntentId: 'pi_cycle_fallback',
        subscriptionId: 'sub_1',
      },
      eventAt,
    })

    expect(dbMocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: '85.00',
        payToken: 'qf_pi_cycle_fallback',
      }),
    })
  })

  it('treats an explicit zero invoice amount_paid as authoritative', async () => {
    await recordRecurringQuotePayment({
      quote: quoteRow(),
      invoice: {
        id: 'in_cycle_zero',
        billingReason: 'subscription_cycle',
        amountPaidCents: 0,
        amountDueCents: 8500,
        paymentIntentId: 'pi_cycle_zero',
        subscriptionId: 'sub_1',
      },
      eventAt,
    })

    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
  })

  it('retries recurring admin notification when the payment row already exists', async () => {
    dbMocks.tx.payment.create.mockRejectedValueOnce({ code: 'P2002' })
    dbMocks.prisma.payment.findUnique.mockResolvedValueOnce({ status: 'PAID' })

    await expect(
      recordRecurringQuotePayment({
        quote: quoteRow(),
        invoice: {
          id: 'in_cycle_1',
          billingReason: 'subscription_cycle',
          amountPaidCents: 8500,
          amountDueCents: 8500,
          paymentIntentId: 'pi_cycle_1',
          subscriptionId: 'sub_1',
        },
        eventAt,
      }),
    ).resolves.toBeUndefined()

    expect(dbMocks.tx.payment.create).toHaveBeenCalledTimes(1)
    expect(dbMocks.prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { payToken: 'qf_pi_cycle_1' },
      select: { status: true },
    })
    expect(notifyMocks.notifyRecurringQuotePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountFormatted: '$85.00',
      }),
    )
  })

  it('does not notify recurring admins when the existing payment is refunded', async () => {
    dbMocks.tx.payment.create.mockRejectedValueOnce({ code: 'P2002' })
    dbMocks.prisma.payment.findUnique.mockResolvedValueOnce({ status: 'REFUNDED' })

    await recordRecurringQuotePayment({
      quote: quoteRow(),
      invoice: {
        id: 'in_cycle_1',
        billingReason: 'subscription_cycle',
        amountPaidCents: 8500,
        amountDueCents: 8500,
        paymentIntentId: 'pi_cycle_1',
        subscriptionId: 'sub_1',
      },
      eventAt,
    })

    expect(notifyMocks.notifyRecurringQuotePayment).not.toHaveBeenCalled()
  })

  it('rejects recurring fulfillment when the quote target is outside its organization', async () => {
    await expect(
      recordRecurringQuotePayment({
        quote: quoteRow({ organizationId: 'org_other' }),
        invoice: {
          id: 'in_cycle_1',
          billingReason: 'subscription_cycle',
          amountPaidCents: 8500,
          amountDueCents: 8500,
          paymentIntentId: 'pi_cycle_1',
          subscriptionId: 'sub_1',
        },
        eventAt,
      }),
    ).rejects.toThrow('lead organization mismatch')

    expect(dbMocks.tx.payment.create).not.toHaveBeenCalled()
  })
})
