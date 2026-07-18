import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    stripeWebhookEventLog: { updateMany: vi.fn(), findFirst: vi.fn() },
    payment: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  return {
    tx,
    prisma: { $transaction: vi.fn() },
  }
})

vi.mock('../../../lib/db', () => ({ prisma: dbMocks.prisma }))

import {
  extractQuotePaymentRefundFacts,
  lockQuotePaymentRefundReference,
  synchronizeQuotePaymentRefund,
} from '../quote-payment-refund-service'

function quotePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment_1',
    paymentQuoteId: 'quote_1',
    status: 'PAID',
    stripeChargeId: 'ch_1',
    ...overrides,
  }
}

describe('quote payment refund service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof dbMocks.tx) => unknown) => callback(dbMocks.tx),
    )
    dbMocks.tx.$executeRaw.mockResolvedValue(1)
    dbMocks.tx.stripeWebhookEventLog.updateMany.mockResolvedValue({ count: 1 })
    dbMocks.tx.payment.findMany.mockResolvedValue([])
    dbMocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
  })

  it('extracts safe identifiers and recognizes only a full refund', () => {
    expect(
      extractQuotePaymentRefundFacts({
        id: 'ch_1',
        payment_intent: { id: 'pi_1' },
        amount: 10_000,
        amount_refunded: 10_000,
        refunded: false,
      }),
    ).toEqual({
      chargeId: 'ch_1',
      paymentIntentId: 'pi_1',
      isFullyRefunded: true,
    })

    expect(
      extractQuotePaymentRefundFacts({
        id: 'ch_1',
        payment_intent: 'pi_1',
        amount: 10_000,
        amount_refunded: 2_500,
        refunded: false,
      }).isFullyRefunded,
    ).toBe(false)
  })

  it('locks charge and payment-intent references with non-row-returning SQL in deterministic order', async () => {
    await lockQuotePaymentRefundReference(dbMocks.tx, {
      chargeId: 'ch_1',
      paymentIntentId: 'pi_1',
    })

    expect(dbMocks.tx.$executeRaw.mock.calls.map((call) => call[1])).toEqual([
      'quote-payment-refund:ch_1',
      'quote-payment-refund:pi_1',
    ])
  })

  it('marks the exact quote-linked charge refunded', async () => {
    dbMocks.tx.payment.findMany.mockResolvedValueOnce([quotePayment()])

    await expect(
      synchronizeQuotePaymentRefund({
        stripeEventId: 'evt_refund_1',
        charge: {
          id: 'ch_1',
          payment_intent: 'pi_1',
          amount: 10_000,
          amount_refunded: 10_000,
          refunded: true,
        },
      }),
    ).resolves.toBe(true)

    expect(dbMocks.tx.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_refund_1', eventType: 'charge.refunded' },
      data: { stripePaymentIntentId: 'pi_1', chargeFullyRefunded: true },
    })
    expect(dbMocks.tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment_1',
        paymentQuoteId: 'quote_1',
        status: 'PAID',
        stripeChargeId: 'ch_1',
      },
      data: { status: 'REFUNDED' },
    })
  })

  it('uses a unique payment-intent fallback only when no charge is stored', async () => {
    dbMocks.tx.payment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([quotePayment({ stripeChargeId: null })])

    await expect(
      synchronizeQuotePaymentRefund({
        stripeEventId: 'evt_refund_fallback',
        charge: { id: 'ch_new', payment_intent: 'pi_1', refunded: true },
      }),
    ).resolves.toBe(true)

    expect(dbMocks.tx.payment.findMany).toHaveBeenLastCalledWith({
      where: {
        paymentQuoteId: { not: null },
        stripePaymentIntentId: 'pi_1',
        stripeChargeId: null,
        status: { in: ['PAID', 'REFUNDED'] },
      },
      select: expect.any(Object),
      take: 2,
    })
    expect(dbMocks.tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment_1',
        paymentQuoteId: 'quote_1',
        status: 'PAID',
        stripePaymentIntentId: 'pi_1',
        stripeChargeId: null,
      },
      data: { status: 'REFUNDED', stripeChargeId: 'ch_new' },
    })
  })

  it('leaves partial refunds paid without querying the ledger', async () => {
    await expect(
      synchronizeQuotePaymentRefund({
        stripeEventId: 'evt_partial',
        charge: {
          id: 'ch_1',
          payment_intent: 'pi_1',
          amount: 10_000,
          amount_refunded: 5_000,
          refunded: false,
        },
      }),
    ).resolves.toBe(false)

    expect(dbMocks.tx.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_partial', eventType: 'charge.refunded' },
      data: { stripePaymentIntentId: 'pi_1', chargeFullyRefunded: false },
    })
    expect(dbMocks.tx.payment.findMany).not.toHaveBeenCalled()
    expect(dbMocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it('does not cross-link a payment-intent fallback to a different stored charge', async () => {
    await expect(
      synchronizeQuotePaymentRefund({
        stripeEventId: 'evt_mismatch',
        charge: { id: 'ch_other', payment_intent: 'pi_1', refunded: true },
      }),
    ).resolves.toBe(false)

    expect(dbMocks.tx.payment.findMany).toHaveBeenCalledTimes(2)
    expect(dbMocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it('treats repeated full-refund events as idempotent', async () => {
    dbMocks.tx.payment.findMany.mockResolvedValueOnce([
      quotePayment({ status: 'REFUNDED' }),
    ])

    await expect(
      synchronizeQuotePaymentRefund({
        stripeEventId: 'evt_repeat',
        charge: { id: 'ch_1', refunded: true },
      }),
    ).resolves.toBe(false)
    expect(dbMocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })
})
