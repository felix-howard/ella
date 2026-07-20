import { describe, expect, it } from 'vitest'
import {
  projectClientPaidServices,
  type ClientPaidServicesQuoteRow,
} from '../client-paid-services-service'

const SCOPE = { clientId: 'client_1', organizationId: 'org_1' }

function customQuote(input: {
  id: string
  paidAt: string
  createdAt?: string
  recurringPayments?: number
}): ClientPaidServicesQuoteRow {
  const paidAt = new Date(input.paidAt)
  return {
    id: input.id,
    organizationId: SCOPE.organizationId,
    clientId: SCOPE.clientId,
    source: 'custom',
    billingInterval: 'month',
    status: 'active',
    lastStripeEventAt: paidAt,
    createdAt: new Date(input.createdAt ?? '2026-07-01T00:00:00.000Z'),
    resultSnapshot: {
      quoteId: input.id,
      lineItems: [
        { label: 'Advisory', unitAmountCents: 50_000, quantity: 1, interval: 'month' },
      ],
    },
    payToken: `token_${input.id}`,
    sentAt: new Date('2026-06-30T00:00:00.000Z'),
    agreement: null,
    payments: Array.from({ length: input.recurringPayments ?? 1 }, (_, index) => ({
      paymentQuoteId: input.id,
      organizationId: SCOPE.organizationId,
      clientId: SCOPE.clientId,
      type: index === 0 ? 'OTHER' : 'RECURRING',
      status: 'PAID',
      paidAt: new Date(paidAt.getTime() + index * 86_400_000),
    })),
    checkoutSessions: [],
  }
}

describe('client paid-services ordering and deduplication', () => {
  it('keeps one quote and one item across multiple recurring payments', () => {
    const groups = projectClientPaidServices([
      customQuote({ id: 'quote_recurring', paidAt: '2026-07-01T00:00:00.000Z', recurringPayments: 3 }),
    ], SCOPE)

    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0]).toEqual(expect.objectContaining({ status: 'ACTIVE' }))
  })

  it('keeps recurring active when a later cycle is refunded but initial settlement remains paid', () => {
    const quote = customQuote({
      id: 'quote_partial_refund',
      paidAt: '2026-07-01T00:00:00.000Z',
      recurringPayments: 2,
    })
    quote.payments[1].status = 'REFUNDED'

    const [group] = projectClientPaidServices([quote], SCOPE)

    expect(group.items[0].status).toBe('ACTIVE')
  })

  it('fails closed when quote health is failed but its event timestamp is missing', () => {
    const quote = customQuote({ id: 'quote_failed', paidAt: '2026-07-01T00:00:00.000Z' })
    quote.status = 'payment_failed'
    quote.lastStripeEventAt = null
    quote.checkoutSessions = [{
      status: 'invoice_paid',
      lastStripeEventAt: new Date('2026-06-30T00:00:00.000Z'),
      updatedAt: new Date('2026-06-30T00:00:00.000Z'),
      createdAt: new Date('2026-06-30T00:00:00.000Z'),
    }]

    const [group] = projectClientPaidServices([quote], SCOPE)

    expect(group.items[0].status).toBe('PAST_DUE')
  })

  it('sorts by first settlement, quote creation, then quote ID', () => {
    const groups = projectClientPaidServices([
      customQuote({ id: 'quote_old', paidAt: '2026-06-01T00:00:00.000Z' }),
      customQuote({ id: 'quote_b', paidAt: '2026-07-01T00:00:00.000Z' }),
      customQuote({
        id: 'quote_newer',
        paidAt: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-07-02T00:00:00.000Z',
      }),
      customQuote({ id: 'quote_a', paidAt: '2026-07-01T00:00:00.000Z' }),
    ], SCOPE)

    expect(groups.map(({ id }) => id)).toEqual([
      'quote_newer',
      'quote_a',
      'quote_b',
      'quote_old',
    ])
  })
})
