import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ClientPaidServicesQueryModule from '../client-paid-services-query'

const queryMocks = vi.hoisted(() => ({ loadClientPaidServiceQuotes: vi.fn() }))

vi.mock('../client-paid-services-query', async (importOriginal) => ({
  ...await importOriginal<typeof ClientPaidServicesQueryModule>(),
  loadClientPaidServiceQuotes: queryMocks.loadClientPaidServiceQuotes,
}))

import {
  listClientPaidServices,
  projectClientPaidServices,
  type ClientPaidServicesQuoteRow,
} from '../client-paid-services-service'

const SCOPE = { clientId: 'client_1', organizationId: 'org_1' }
const PAID_AT = new Date('2026-07-15T10:00:00.000Z')

function payment(overrides: Record<string, unknown> = {}) {
  return {
    paymentQuoteId: 'quote_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    type: 'OTHER',
    status: 'PAID',
    paidAt: PAID_AT,
    ...overrides,
  }
}

function calculatorQuote(
  overrides: Partial<ClientPaidServicesQuoteRow> = {},
): ClientPaidServicesQuoteRow {
  return {
    id: 'quote_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    source: 'calculator',
    billingInterval: null,
    status: 'active',
    lastStripeEventAt: PAID_AT,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    resultSnapshot: {
      quoteId: 'quote_1',
      monthlyItems: [{ label: 'Bookkeeping', amount: 75, kind: 'monthly' }],
      setupItems: [{ label: 'Setup', amount: 500, kind: 'setup' }],
    },
    payToken: 'pay_token',
    sentAt: new Date('2026-07-14T12:00:00.000Z'),
    agreement: {
      id: 'agreement_1',
      title: '2026 Engagement Letter',
      status: 'SIGNED',
      source: 'CALCULATOR',
      type: 'ENGAGEMENT_LETTER',
      clientId: 'client_1',
      organizationId: 'org_1',
      paymentQuoteId: 'quote_1',
      signedAt: null,
    },
    payments: [payment()],
    checkoutSessions: [],
    ...overrides,
  }
}

function customQuote(overrides: Partial<ClientPaidServicesQuoteRow> = {}) {
  return calculatorQuote({
    source: 'custom',
    billingInterval: 'year',
    agreement: null,
    resultSnapshot: {
      quoteId: 'quote_1',
      lineItems: [
        { label: 'Advisory', unitAmountCents: 50_000, quantity: 1, interval: 'year' },
      ],
    },
    ...overrides,
  })
}

afterEach(() => vi.restoreAllMocks())
beforeEach(() => queryMocks.loadClientPaidServiceQuotes.mockReset())

describe('client paid-services listing', () => {
  it('finds the newest 101 valid groups across malformed and ineligible candidates', async () => {
    const recent = customQuoteForList(
      'quote_recently_paid',
      new Date('2026-07-20T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    )
    const malformed = customQuoteForList(
      'quote_malformed',
      new Date('2026-07-19T00:00:00.000Z'),
      new Date('2026-07-19T00:00:00.000Z'),
      { secret: 'invalid' },
    )
    const ineligible = customQuoteForList(
      'quote_ineligible',
      new Date('2026-07-18T00:00:00.000Z'),
      new Date('2026-07-18T00:00:00.000Z'),
    )
    ineligible.payToken = null
    const firstPage = [
      recent,
      malformed,
      ineligible,
      ...Array.from({ length: 97 }, (_, index) => customQuoteForList(
        `quote_page_1_${index}`,
        new Date(Date.parse('2026-07-17T00:00:00.000Z') - index * 1_000),
        new Date(Date.parse('2026-07-01T00:00:00.000Z') + index * 1_000),
      )),
    ]
    const secondPage = Array.from({ length: 3 }, (_, index) => customQuoteForList(
      `quote_page_2_${index}`,
      new Date(Date.parse('2026-07-16T00:00:00.000Z') - index * 1_000),
      new Date(Date.parse('2026-07-16T00:00:00.000Z') + index * 1_000),
    ))
    const nextCursor = {
      firstPaidAt: new Date('2026-07-17T00:00:00.000Z'),
      quoteId: 'quote_page_1_96',
    }
    queryMocks.loadClientPaidServiceQuotes
      .mockResolvedValueOnce({ quotes: firstPage, nextCursor })
      .mockResolvedValueOnce({ quotes: secondPage, nextCursor: null })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await listClientPaidServices(SCOPE)

    expect(result.data).toHaveLength(100)
    expect(result.data[0].id).toBe('quote_recently_paid')
    expect(result.data.map(({ id }) => id)).not.toContain('quote_malformed')
    expect(result.data.map(({ id }) => id)).not.toContain('quote_ineligible')
    expect(result.meta).toEqual({ isTruncated: true, limit: 100 })
    expect(queryMocks.loadClientPaidServiceQuotes.mock.calls).toEqual([
      [{ ...SCOPE, cursor: null, limit: 100 }],
      [{ ...SCOPE, cursor: nextCursor, limit: 100 }],
    ])
  })

  it('reports no truncation for exactly 100 valid groups after malformed pages', async () => {
    const firstCursor = {
      firstPaidAt: new Date('2026-07-18T00:00:00.000Z'),
      quoteId: 'quote_malformed_99',
    }
    const secondCursor = {
      firstPaidAt: new Date('2026-07-17T00:00:00.000Z'),
      quoteId: 'quote_valid_99',
    }
    const malformedPage = Array.from({ length: 100 }, (_, index) => customQuoteForList(
      `quote_malformed_${index}`,
      new Date(Date.parse('2026-07-19T00:00:00.000Z') - index * 1_000),
      new Date('2026-07-01T00:00:00.000Z'),
      { invalid: true },
    ))
    const validPage = Array.from({ length: 100 }, (_, index) => customQuoteForList(
      `quote_valid_${index}`,
      new Date(Date.parse('2026-07-18T00:00:00.000Z') - index * 1_000),
      new Date('2026-07-01T00:00:00.000Z'),
    ))
    queryMocks.loadClientPaidServiceQuotes
      .mockResolvedValueOnce({ quotes: malformedPage, nextCursor: firstCursor })
      .mockResolvedValueOnce({ quotes: validPage, nextCursor: secondCursor })
      .mockResolvedValueOnce({ quotes: [], nextCursor: null })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await listClientPaidServices(SCOPE)

    expect(result.data).toHaveLength(100)
    expect(result.meta).toEqual({ isTruncated: false, limit: 100 })
    expect(queryMocks.loadClientPaidServiceQuotes).toHaveBeenCalledTimes(3)
  })
})

describe('client paid-services projection', () => {
  it('returns signed calculator items once with a staff-safe agreement summary', () => {
    const [group] = projectClientPaidServices([calculatorQuote()], SCOPE)

    expect(group).toEqual({
      id: 'quote_1',
      source: 'CALCULATOR_AGREEMENT',
      paidAt: PAID_AT.toISOString(),
      agreement: {
        id: 'agreement_1',
        title: '2026 Engagement Letter',
        signedAt: null,
      },
      items: [
        expect.objectContaining({ label: 'Bookkeeping', status: 'ACTIVE' }),
        expect.objectContaining({ label: 'Setup', status: 'PAID' }),
      ],
    })

    const forbidden = ['amount', 'token', 'stripe', 'snapshot', 'receipt', 'quantity']
    expect(collectKeys(group).filter((key) => forbidden.some((word) => key.includes(word)))).toEqual([])
  })

  it.each([
    { agreement: null },
    { agreement: { ...calculatorQuote().agreement!, status: 'SENT' } },
    { agreement: { ...calculatorQuote().agreement!, status: 'VOIDED' } },
    { agreement: { ...calculatorQuote().agreement!, source: 'MANUAL' } },
    { agreement: { ...calculatorQuote().agreement!, type: 'SERVICE_AGREEMENT' } },
  ])('excludes calculator quotes without the exact signed agreement link', (override) => {
    expect(projectClientPaidServices([calculatorQuote(override)], SCOPE)).toEqual([])
  })

  it('requires custom links to be sent, client-linked, and directly settled', () => {
    expect(projectClientPaidServices([customQuote()], SCOPE)[0]).toEqual(
      expect.objectContaining({ source: 'CUSTOM_LINK', agreement: null }),
    )
    expect(projectClientPaidServices([customQuote({ payToken: null })], SCOPE)).toEqual([])
    expect(projectClientPaidServices([customQuote({ sentAt: null })], SCOPE)).toEqual([])
    expect(projectClientPaidServices([customQuote({ clientId: null })], SCOPE)).toEqual([])
  })

  it('rejects cross-scope and unlinked payment evidence', () => {
    const badPayments = [
      payment({ organizationId: 'org_other' }),
      payment({ clientId: 'client_other' }),
      payment({ paymentQuoteId: null }),
      payment({ status: 'PENDING' }),
    ]
    expect(projectClientPaidServices([calculatorQuote({ payments: badPayments })], SCOPE)).toEqual([])
  })

  it('does not fabricate a one-time purchase from recurring-only evidence', () => {
    const [group] = projectClientPaidServices([
      calculatorQuote({ payments: [payment({ type: 'RECURRING' })] }),
    ], SCOPE)

    expect(group.items.map((item) => item.label)).toEqual(['Bookkeeping'])
  })

  it('derives separate refunded setup and active recurring states', () => {
    const [group] = projectClientPaidServices([
      calculatorQuote({
        payments: [
          payment({ status: 'REFUNDED' }),
          payment({ type: 'RECURRING', paidAt: new Date('2026-08-15T10:00:00.000Z') }),
        ],
      }),
    ], SCOPE)

    expect(group.items.map(({ label, status }) => [label, status])).toEqual([
      ['Bookkeeping', 'ACTIVE'],
      ['Setup', 'REFUNDED'],
    ])
  })

  it.each([
    ['payment_failed', [], 'PAST_DUE'],
    ['active', [{ status: 'invoice_paid' }], 'ACTIVE'],
    ['canceled', [{ status: 'subscription_canceled' }], 'ENDED'],
  ])('maps recurring quote status %s', (quoteStatus, sessions, expected) => {
    const checkoutSessions = sessions.map((session) => ({
      ...session,
      lastStripeEventAt: new Date('2026-08-15T10:00:00.000Z'),
      updatedAt: new Date('2026-08-15T10:00:00.000Z'),
      createdAt: PAID_AT,
    }))
    const [group] = projectClientPaidServices([
      calculatorQuote({ status: quoteStatus, checkoutSessions }),
    ], SCOPE)
    expect(group.items[0].status).toBe(expected)
  })

  it('lets an all-refunded recurring purchase override ended health', () => {
    const [group] = projectClientPaidServices([
      customQuote({ status: 'canceled', payments: [payment({ status: 'REFUNDED' })] }),
    ], SCOPE)
    expect(group.items[0].status).toBe('REFUNDED')
  })

  it('skips only a malformed quote and logs no snapshot content', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const groups = projectClientPaidServices([
      calculatorQuote({
        id: 'quote_bad',
        agreement: { ...calculatorQuote().agreement!, paymentQuoteId: 'quote_bad' },
        resultSnapshot: { secret: 'do-not-log' },
        payments: [payment({ paymentQuoteId: 'quote_bad' })],
      }),
      customQuote(),
    ], SCOPE)

    expect(groups).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(
      '[PaidServices] Skipping malformed quote=quote_bad error=ZodError',
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('do-not-log')
  })
})

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  return Object.entries(value).flatMap(([key, nested]) => [key.toLowerCase(), ...collectKeys(nested)])
}

function customQuoteForList(
  id: string,
  paidAt: Date,
  createdAt: Date,
  resultSnapshot: unknown = {
    quoteId: id,
    lineItems: [{
      label: 'Advisory',
      unitAmountCents: 50_000,
      quantity: 1,
      interval: 'year',
    }],
  },
): ClientPaidServicesQuoteRow {
  return customQuote({
    id,
    createdAt,
    resultSnapshot,
    payments: [payment({ paymentQuoteId: id, paidAt })],
  })
}
