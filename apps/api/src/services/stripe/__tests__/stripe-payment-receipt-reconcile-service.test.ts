import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  payment: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}))

const stripeClientMocks = vi.hoisted(() => ({
  assertStripeConfigured: vi.fn(),
}))

const receiptFactMocks = vi.hoisted(() => ({
  getReceiptFactsFromInvoice: vi.fn(),
  getReceiptFactsFromPaymentIntentId: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../client', () => stripeClientMocks)
vi.mock('../stripe-receipt-facts', () => ({
  getReceiptFactsFromInvoice: receiptFactMocks.getReceiptFactsFromInvoice,
  getReceiptFactsFromPaymentIntentId: receiptFactMocks.getReceiptFactsFromPaymentIntentId,
  mergeReceiptFacts: (...factsList: Array<Record<string, unknown>>) => {
    const merged: Record<string, unknown> = {}
    for (const facts of factsList) {
      for (const [key, value] of Object.entries(facts)) {
        if (!merged[key] && value) merged[key] = value
      }
    }
    return merged
  },
}))

import { reconcilePaymentReceiptFacts } from '../stripe-payment-receipt-reconcile-service'

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    clientId: 'client_1',
    organizationId: 'org_1',
    status: 'PAID',
    amount: '500.00',
    paidAt: new Date('2026-06-08T10:00:00Z'),
    stripeCustomerId: null,
    stripeInvoiceId: 'in_123',
    stripePaymentIntentId: 'pi_stale',
    stripeChargeId: null,
    stripeReceiptUrl: null,
    stripeReceiptNumber: null,
    stripeHostedInvoiceUrl: null,
    stripeInvoicePdfUrl: null,
    paymentMethodBrand: null,
    paymentMethodLast4: null,
    receiptSyncedAt: null,
    agreement: null,
    ...overrides,
  }
}

describe('reconcilePaymentReceiptFacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    receiptFactMocks.getReceiptFactsFromInvoice.mockResolvedValue({})
    receiptFactMocks.getReceiptFactsFromPaymentIntentId.mockResolvedValue({})
  })

  it('loads one org-scoped client payment and updates only receipt fields', async () => {
    const existing = paymentRow()
    prismaMocks.payment.findFirst
      .mockResolvedValueOnce(existing)
      .mockImplementation(async () => ({
        ...existing,
        stripeCustomerId: 'cus_123',
        stripePaymentIntentId: 'pi_invoice_123',
        stripeChargeId: 'ch_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/ch_123',
        stripeReceiptNumber: 'R-123',
        stripeHostedInvoiceUrl: 'https://invoice.stripe.com/i/in_123',
        stripeInvoicePdfUrl: 'https://invoice.stripe.com/i/in_123.pdf',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
        receiptSyncedAt: new Date('2026-06-08T10:01:00Z'),
      }))
    prismaMocks.payment.updateMany.mockResolvedValue({ count: 1 })
    receiptFactMocks.getReceiptFactsFromInvoice.mockResolvedValue({
      stripeCustomerId: 'cus_123',
      stripeInvoiceId: 'in_123',
      stripePaymentIntentId: 'pi_invoice_123',
      stripeHostedInvoiceUrl: 'https://invoice.stripe.com/i/in_123',
      stripeInvoicePdfUrl: 'https://invoice.stripe.com/i/in_123.pdf',
    })
    receiptFactMocks.getReceiptFactsFromPaymentIntentId.mockResolvedValue({
      stripeCustomerId: 'cus_123',
      stripePaymentIntentId: 'pi_invoice_123',
      stripeChargeId: 'ch_123',
      stripeReceiptUrl: 'https://pay.stripe.com/receipts/ch_123',
      stripeReceiptNumber: 'R-123',
      paymentMethodBrand: 'visa',
      paymentMethodLast4: '4242',
    })

    const result = await reconcilePaymentReceiptFacts({
      paymentId: 'pay_1',
      clientId: 'client_1',
      organizationId: 'org_1',
    })

    expect(stripeClientMocks.assertStripeConfigured).toHaveBeenCalled()
    expect(prismaMocks.payment.findFirst).toHaveBeenCalledWith({
      where: { id: 'pay_1', clientId: 'client_1', organizationId: 'org_1' },
      include: { agreement: { select: { id: true, title: true } } },
    })
    expect(receiptFactMocks.getReceiptFactsFromInvoice).toHaveBeenCalledWith('in_123')
    expect(receiptFactMocks.getReceiptFactsFromPaymentIntentId).toHaveBeenCalledWith(
      'pi_invoice_123'
    )
    expect(prismaMocks.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay_1', clientId: 'client_1', organizationId: 'org_1' },
      data: {
        stripeCustomerId: 'cus_123',
        stripePaymentIntentId: 'pi_invoice_123',
        stripeChargeId: 'ch_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/ch_123',
        stripeReceiptNumber: 'R-123',
        stripeHostedInvoiceUrl: 'https://invoice.stripe.com/i/in_123',
        stripeInvoicePdfUrl: 'https://invoice.stripe.com/i/in_123.pdf',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
        receiptSyncedAt: expect.any(Date),
      },
    })
    expect(prismaMocks.payment.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty('amount')
    expect(prismaMocks.payment.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty('status')
    expect(prismaMocks.payment.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty('paidAt')
    expect(result).toEqual({ refreshed: true, payment: expect.any(Object) })
  })

  it('returns null without Stripe lookups when payment is outside the scoped client org', async () => {
    prismaMocks.payment.findFirst.mockResolvedValue(null)

    await expect(
      reconcilePaymentReceiptFacts({
        paymentId: 'pay_1',
        clientId: 'wrong_client',
        organizationId: 'org_1',
      })
    ).resolves.toBeNull()

    expect(receiptFactMocks.getReceiptFactsFromInvoice).not.toHaveBeenCalled()
    expect(receiptFactMocks.getReceiptFactsFromPaymentIntentId).not.toHaveBeenCalled()
    expect(prismaMocks.payment.updateMany).not.toHaveBeenCalled()
  })
})
