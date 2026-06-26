import { describe, expect, it } from 'vitest'
import { buildCustomQuote, type CustomQuoteInput } from '../custom-quote-builder'
import { CheckoutQuoteError } from '../quote-calculator'
import {
  CALCULATOR_MONTHLY_LABEL,
  CALCULATOR_SETUP_LABEL,
  toCheckoutLineItems,
} from '../checkout-line-items'

const item = (overrides: Partial<CustomQuoteInput['items'][number]> = {}) => ({
  label: 'Consulting',
  unitAmountCents: 5000,
  quantity: 1,
  ...overrides,
})

describe('buildCustomQuote', () => {
  it('builds a one-time quote (all items become setup items)', () => {
    const { quote, lineItems, billingInterval } = buildCustomQuote({
      billingInterval: 'one_time',
      items: [item({ unitAmountCents: 10_000, quantity: 2 })],
    })

    expect(billingInterval).toBe('one_time')
    expect(quote.monthlyItems).toHaveLength(0)
    expect(quote.monthlyTotal).toBe(0)
    expect(quote.setupItems).toEqual([{ label: 'Consulting', amount: 200, kind: 'setup' }])
    expect(quote.setupTotal).toBe(200)
    expect(quote.quoteId).toMatch(/^quote_/)
    expect(lineItems).toEqual([
      { label: 'Consulting', description: undefined, unitAmountCents: 10_000, quantity: 2, interval: 'one_time' },
    ])
  })

  it('builds a monthly recurring quote with a one-time add-on', () => {
    const { quote, lineItems } = buildCustomQuote({
      billingInterval: 'month',
      items: [item({ label: 'Retainer', unitAmountCents: 30_000, quantity: 1 })],
      oneTimeItems: [item({ label: 'Onboarding', unitAmountCents: 15_000, quantity: 1 })],
    })

    expect(quote.monthlyTotal).toBe(300)
    expect(quote.setupTotal).toBe(150)
    expect(quote.monthlyItems).toEqual([{ label: 'Retainer', amount: 300, kind: 'monthly' }])
    expect(quote.setupItems).toEqual([{ label: 'Onboarding', amount: 150, kind: 'setup' }])
    expect(lineItems.map((l) => l.interval)).toEqual(['month', 'one_time'])
  })

  it('builds a yearly recurring quote', () => {
    const { quote, lineItems, billingInterval } = buildCustomQuote({
      billingInterval: 'year',
      items: [item({ label: 'Annual plan', unitAmountCents: 120_000, quantity: 1 })],
    })

    expect(billingInterval).toBe('year')
    expect(quote.monthlyTotal).toBe(1200)
    expect(lineItems[0].interval).toBe('year')
  })

  it('normalizes item names as single-line and preserves description lines', () => {
    const { quote, lineItems } = buildCustomQuote({
      billingInterval: 'one_time',
      items: [
        item({
          label: ' Tax work \n bundle ',
          description: ' Tax Analysis \n\n Bookkeeping ',
        }),
      ],
    })

    expect(quote.setupItems[0]).toMatchObject({
      label: 'Tax work bundle',
      description: 'Tax Analysis\nBookkeeping',
    })
    expect(lineItems[0]).toMatchObject({
      label: 'Tax work bundle',
      description: 'Tax Analysis\nBookkeeping',
    })
  })

  it('preserves fractional dollar amounts without float drift', () => {
    const { quote } = buildCustomQuote({
      billingInterval: 'one_time',
      items: [item({ unitAmountCents: 1999, quantity: 3 })],
    })

    // 1999 * 3 = 5997 cents -> 59.97 dollars; *100 round-trips back to 5997.
    expect(quote.setupTotal).toBe(59.97)
    expect(Math.round(quote.setupTotal * 100)).toBe(5997)
  })

  it('rejects an empty item list', () => {
    expect(() => buildCustomQuote({ billingInterval: 'one_time', items: [] })).toThrow(
      CheckoutQuoteError
    )
  })

  it('rejects a zero or negative amount', () => {
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ unitAmountCents: 0 })] })
    ).toThrow(/amount must be/)
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ unitAmountCents: -100 })] })
    ).toThrow(CheckoutQuoteError)
  })

  it('rejects a non-integer amount', () => {
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ unitAmountCents: 12.5 })] })
    ).toThrow(/amount must be/)
  })

  it('rejects an out-of-range quantity', () => {
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ quantity: 0 })] })
    ).toThrow(/quantity must be/)
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ quantity: 1001 })] })
    ).toThrow(/quantity must be/)
  })

  it('rejects an empty or over-long label', () => {
    expect(() =>
      buildCustomQuote({ billingInterval: 'one_time', items: [item({ label: '   ' })] })
    ).toThrow(/label must be/)
    expect(() =>
      buildCustomQuote({
        billingInterval: 'one_time',
        items: [item({ label: 'x'.repeat(121) })],
      })
    ).toThrow(/label must be/)
  })

  it('rejects an over-long description', () => {
    expect(() =>
      buildCustomQuote({
        billingInterval: 'one_time',
        items: [item({ description: 'd'.repeat(501) })],
      })
    ).toThrow(/description must be/)
  })

  it('rejects a total above the checkout sanity ceiling', () => {
    // 999_999 dollars is the per-line/total ceiling; 1_000_000 dollars exceeds it.
    expect(() =>
      buildCustomQuote({
        billingInterval: 'one_time',
        items: [item({ unitAmountCents: 1_000_000_00, quantity: 1 })],
      })
    ).toThrow(/too large/)
  })
})

describe('toCheckoutLineItems', () => {
  it('collapses a calculator quote to the 2 canonical aggregate lines', () => {
    const lines = toCheckoutLineItems({
      quoteId: 'quote_calc',
      monthlyItems: [{ label: 'Basic tier', amount: 200, kind: 'monthly' }],
      setupItems: [{ label: 'Setup', amount: 150, kind: 'setup' }],
      monthlyTotal: 200,
      setupTotal: 150,
    })

    expect(lines).toEqual([
      { label: CALCULATOR_MONTHLY_LABEL, unitAmountCents: 20_000, quantity: 1, interval: 'month' },
      { label: CALCULATOR_SETUP_LABEL, unitAmountCents: 15_000, quantity: 1, interval: 'one_time' },
    ])
  })

  it('omits the monthly line when there is no recurring total', () => {
    const lines = toCheckoutLineItems({
      quoteId: 'quote_calc',
      monthlyItems: [],
      setupItems: [{ label: 'Setup', amount: 150, kind: 'setup' }],
      monthlyTotal: 0,
      setupTotal: 150,
    })

    expect(lines).toEqual([
      { label: CALCULATOR_SETUP_LABEL, unitAmountCents: 15_000, quantity: 1, interval: 'one_time' },
    ])
  })
})
