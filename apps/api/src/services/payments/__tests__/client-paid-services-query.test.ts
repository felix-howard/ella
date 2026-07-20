import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: { findMany: vi.fn() },
  payment: { groupBy: vi.fn() },
  $queryRaw: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

import { loadClientPaidServiceQuotes } from '../client-paid-services-query'

describe('client paid-services query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.paymentQuote.findMany.mockResolvedValue([])
    prismaMocks.payment.groupBy.mockResolvedValue([])
    prismaMocks.$queryRaw.mockResolvedValue([])
  })

  it('uses bounded payment aggregates with repeated tenant and settlement filters', async () => {
    const paidAt = new Date('2026-07-01T00:00:00.000Z')
    prismaMocks.payment.groupBy
      .mockResolvedValueOnce([{ paymentQuoteId: 'quote_1', _min: { paidAt } }])
      .mockResolvedValueOnce([])
    prismaMocks.paymentQuote.findMany.mockResolvedValueOnce([{ id: 'quote_1' }])
    await loadClientPaidServiceQuotes({ clientId: 'client_1', organizationId: 'org_1' })

    const query = prismaMocks.paymentQuote.findMany.mock.calls[0][0]
    const candidateQuery = prismaMocks.payment.groupBy.mock.calls[0][0]
    const evidenceQuery = prismaMocks.payment.groupBy.mock.calls[1][0]
    const evidenceFilter = {
      clientId: 'client_1',
      organizationId: 'org_1',
      type: { in: ['OTHER', 'RECURRING'] },
      status: { in: ['PAID', 'REFUNDED'] },
      paidAt: { not: null },
    }
    expect(query.where).toEqual(expect.objectContaining({
      id: { in: ['quote_1'] },
      clientId: 'client_1',
      organizationId: 'org_1',
      OR: expect.any(Array),
    }))
    expect(candidateQuery).toEqual(expect.objectContaining({
      by: ['paymentQuoteId'],
      where: expect.objectContaining({
        ...evidenceFilter,
        paymentQuoteId: { not: null },
        paymentQuote: { is: expect.objectContaining({
          clientId: 'client_1',
          organizationId: 'org_1',
          OR: expect.any(Array),
        }) },
      }),
      _min: { paidAt: true },
      having: undefined,
      orderBy: [{ _min: { paidAt: 'desc' } }, { paymentQuoteId: 'asc' }],
      take: 101,
    }))
    expect(query.select).not.toHaveProperty('payments')
    expect(evidenceQuery).toEqual({
      by: ['paymentQuoteId', 'type', 'status'],
      where: {
        ...evidenceFilter,
        paymentQuoteId: { in: ['quote_1'] },
      },
      _min: { paidAt: true },
    })
  })

  it('returns the newest bounded history and signals truncation above the view limit', async () => {
    const paidAt = new Date('2026-07-01T00:00:00.000Z')
    prismaMocks.payment.groupBy
      .mockResolvedValueOnce(Array.from({ length: 101 }, (_, index) => ({
        paymentQuoteId: `quote_${index + 1}`,
        _min: { paidAt },
      })))
      .mockResolvedValueOnce([])
    prismaMocks.paymentQuote.findMany.mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, index) => ({ id: `quote_${index + 1}` })),
    )

    const result = await loadClientPaidServiceQuotes({
      clientId: 'client_1',
      organizationId: 'org_1',
    })

    expect(result.quotes).toHaveLength(100)
    expect(result.quotes.at(-1)?.id).toBe('quote_100')
    expect(result.nextCursor).toEqual({
      firstPaidAt: paidAt,
      quoteId: 'quote_100',
    })
    expect(prismaMocks.payment.groupBy.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        paymentQuoteId: { in: Array.from({ length: 100 }, (_, index) => `quote_${index + 1}`) },
      }),
    }))
    expect(prismaMocks.$queryRaw).toHaveBeenCalledOnce()
  })

  it('returns compact lifecycle evidence without loading checkout or payment histories', async () => {
    const paidAt = new Date('2026-07-01T00:00:00.000Z')
    const recoveredAt = new Date('2026-07-15T00:00:00.000Z')
    const canceledAt = new Date('2026-07-20T00:00:00.000Z')
    prismaMocks.paymentQuote.findMany.mockResolvedValueOnce([{ id: 'quote_1' }])
    prismaMocks.payment.groupBy
      .mockResolvedValueOnce([{ paymentQuoteId: 'quote_1', _min: { paidAt } }])
      .mockResolvedValueOnce([{
        paymentQuoteId: 'quote_1',
        type: 'OTHER',
        status: 'PAID',
        _min: { paidAt },
      }])
    prismaMocks.$queryRaw.mockResolvedValueOnce([{
      paymentQuoteId: 'quote_1',
      canceledAt,
      latestHealthStatus: 'invoice_paid',
      latestHealthAt: recoveredAt,
    }])

    const { quotes: [quote], nextCursor } = await loadClientPaidServiceQuotes({
      clientId: 'client_1',
      organizationId: 'org_1',
    })

    const select = prismaMocks.paymentQuote.findMany.mock.calls[0][0].select
    expect(select).not.toHaveProperty('checkoutSessions')
    expect(collectKeys(select).some((key) => key.startsWith('stripe'))).toBe(false)
    expect(prismaMocks.$queryRaw).toHaveBeenCalledTimes(1)
    expect(nextCursor).toBeNull()
    expect(quote.payments).toEqual([{
      paymentQuoteId: 'quote_1',
      organizationId: 'org_1',
      clientId: 'client_1',
      type: 'OTHER',
      status: 'PAID',
      paidAt,
    }])
    expect(quote.checkoutSessions).toEqual([{
      status: 'invoice_paid',
      lastStripeEventAt: recoveredAt,
      updatedAt: recoveredAt,
      createdAt: recoveredAt,
    }, {
      status: 'subscription_canceled',
      lastStripeEventAt: canceledAt,
      updatedAt: canceledAt,
      createdAt: canceledAt,
    }])
  })

  it('preserves first-settlement order instead of quote creation order', async () => {
    const recentSettlement = new Date('2026-07-20T00:00:00.000Z')
    const olderSettlement = new Date('2026-07-10T00:00:00.000Z')
    prismaMocks.payment.groupBy
      .mockResolvedValueOnce([
        { paymentQuoteId: 'quote_created_first', _min: { paidAt: recentSettlement } },
        { paymentQuoteId: 'quote_created_last', _min: { paidAt: olderSettlement } },
      ])
      .mockResolvedValueOnce([])
    prismaMocks.paymentQuote.findMany.mockResolvedValueOnce([
      { id: 'quote_created_last', createdAt: new Date('2026-07-19T00:00:00.000Z') },
      { id: 'quote_created_first', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ])

    const result = await loadClientPaidServiceQuotes({
      clientId: 'client_1',
      organizationId: 'org_1',
    })

    expect(result.quotes.map(({ id }) => id)).toEqual([
      'quote_created_first',
      'quote_created_last',
    ])
  })

  it('uses the first-settlement keyset for subsequent candidate pages', async () => {
    const cursor = {
      firstPaidAt: new Date('2026-07-10T00:00:00.000Z'),
      quoteId: 'quote_100',
    }

    await loadClientPaidServiceQuotes({
      clientId: 'client_1',
      organizationId: 'org_1',
      cursor,
    })

    expect(prismaMocks.payment.groupBy.mock.calls[0][0].having).toEqual({
      OR: [
        { paidAt: { _min: { lt: cursor.firstPaidAt } } },
        {
          AND: [
            { paidAt: { _min: { equals: cursor.firstPaidAt } } },
            { paymentQuoteId: { gt: cursor.quoteId } },
          ],
        },
      ],
    })
  })
})

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)])
}
