import { describe, expect, it } from 'vitest'
import { parsePaidServiceSnapshot } from '../paid-service-snapshot-parser'

describe('paid-service snapshot parser', () => {
  it('normalizes calculator items in frozen monthly then setup order', () => {
    expect(
      parsePaidServiceSnapshot({
        quoteId: 'quote_calculator',
        source: 'calculator',
        billingInterval: null,
        snapshot: {
          quoteId: 'quote_calculator',
          monthlyItems: [{ label: 'Bookkeeping', amount: 75, kind: 'monthly' }],
          setupItems: [{ label: 'Setup', amount: 500, kind: 'setup' }],
        },
      }),
    ).toEqual([
      {
        id: 'monthly-1',
        label: 'Bookkeeping',
        description: null,
        category: 'RECURRING',
        cadence: 'MONTH',
      },
      {
        id: 'setup-1',
        label: 'Setup',
        description: null,
        category: 'ONE_TIME',
        cadence: 'ONE_TIME',
      },
    ])
  })

  it.each([
    ['month', 'MONTH'],
    ['year', 'YEAR'],
  ] as const)('normalizes custom %s and one-time items', (interval, cadence) => {
    const items = parsePaidServiceSnapshot({
      quoteId: 'quote_custom',
      source: 'custom',
      billingInterval: interval,
      snapshot: {
        quoteId: 'quote_custom',
        lineItems: [
          {
            label: 'Advisory',
            description: 'Quarterly planning',
            unitAmountCents: 50_000,
            quantity: 2,
            interval,
          },
          {
            label: 'Onboarding',
            unitAmountCents: 25_000,
            quantity: 1,
            interval: 'one_time',
          },
        ],
      },
    })

    expect(items).toEqual([
      expect.objectContaining({ category: 'RECURRING', cadence }),
      expect.objectContaining({ category: 'ONE_TIME', cadence: 'ONE_TIME' }),
    ])
  })

  it.each([
    { quoteId: 'other', monthlyItems: [], setupItems: [{ label: 'Setup', amount: 1, kind: 'setup' }] },
    { quoteId: 'quote_calculator', monthlyItems: [], setupItems: [] },
    {
      quoteId: 'quote_calculator',
      monthlyItems: [{ label: 'Bad', amount: Number.POSITIVE_INFINITY, kind: 'monthly' }],
      setupItems: [],
    },
  ])('rejects malformed calculator snapshots', (snapshot) => {
    expect(() =>
      parsePaidServiceSnapshot({
        quoteId: 'quote_calculator',
        source: 'calculator',
        billingInterval: null,
        snapshot,
      }),
    ).toThrow()
  })

  it('rejects custom items whose interval conflicts with the quote cadence', () => {
    expect(() =>
      parsePaidServiceSnapshot({
        quoteId: 'quote_custom',
        source: 'custom',
        billingInterval: 'month',
        snapshot: {
          quoteId: 'quote_custom',
          lineItems: [
            {
              label: 'Annual service',
              unitAmountCents: 10_000,
              quantity: 1,
              interval: 'year',
            },
          ],
        },
      }),
    ).toThrow('billing interval mismatch')
  })
})
