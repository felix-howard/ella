import { describe, expect, it } from 'vitest'
import {
  MAX_UNIT_AMOUNT_CENTS,
  computeBillingTotals,
  computeTotalCents,
  dollarsToCents,
  draftsToCoreBillingPayload,
  draftToApiItem,
  draftsToApiItems,
  parseQuantity,
  rowLineCents,
  type CustomItemDraft,
} from '../custom-link-types'
import {
  draftsToTemplatePayload,
  templatePayloadToDrafts,
} from '../custom-link-template-conversion'

function draft(overrides: Partial<CustomItemDraft>): CustomItemDraft {
  return {
    id: 'x',
    label: 'Item',
    description: '',
    amount: '10',
    quantity: '1',
    billingInterval: 'one_time',
    ...overrides,
  }
}

describe('dollarsToCents', () => {
  it('converts dollars to integer cents', () => {
    expect(dollarsToCents('49.99')).toBe(4999)
    expect(dollarsToCents('10')).toBe(1000)
    expect(dollarsToCents('0.01')).toBe(1)
  })

  it('rounds sub-cent input to the nearest cent', () => {
    // Avoids x.xx5 ties, which are inherently float-ambiguous (1.005 is stored
    // as 1.00499…). The input is step="0.01"; >2-decimal entry is an edge case.
    expect(dollarsToCents('1.999')).toBe(200)
    expect(dollarsToCents('1.991')).toBe(199)
  })

  it('rejects blank, negative, zero, non-numeric, and over-cap values', () => {
    expect(dollarsToCents('')).toBeNull()
    expect(dollarsToCents('   ')).toBeNull()
    expect(dollarsToCents('-5')).toBeNull()
    expect(dollarsToCents('0')).toBeNull()
    expect(dollarsToCents('abc')).toBeNull()
    expect(dollarsToCents(String(MAX_UNIT_AMOUNT_CENTS / 100 + 1))).toBeNull()
  })
})

describe('parseQuantity', () => {
  it('accepts positive integers within bounds', () => {
    expect(parseQuantity('1')).toBe(1)
    expect(parseQuantity('1000')).toBe(1000)
  })

  it('rejects zero, negatives, over-cap, and non-integers', () => {
    expect(parseQuantity('0')).toBeNull()
    expect(parseQuantity('-2')).toBeNull()
    expect(parseQuantity('1001')).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
})

describe('rowLineCents + computeTotalCents', () => {
  it('multiplies unit by quantity', () => {
    expect(rowLineCents(draft({ amount: '49.99', quantity: '2' }))).toBe(9998)
  })

  it('returns null for an incomplete row', () => {
    expect(rowLineCents(draft({ amount: '' }))).toBeNull()
  })

  it('sums only valid rows, skipping incomplete ones', () => {
    const items = [
      draft({ id: 'a', amount: '10', quantity: '1' }),
      draft({ id: 'b', amount: '', quantity: '1' }),
      draft({ id: 'c', amount: '5.50', quantity: '2' }),
    ]
    expect(computeTotalCents(items)).toBe(1000 + 1100)
  })
})

describe('computeBillingTotals', () => {
  it('counts recurring rows in due today and then-recurring totals', () => {
    const totals = computeBillingTotals([
      draft({ id: 'setup', amount: '100', billingInterval: 'one_time' }),
      draft({ id: 'monthly', amount: '50', quantity: '2', billingInterval: 'month' }),
    ])

    expect(totals).toEqual({
      dueTodayCents: 20_000,
      recurringCents: 10_000,
      oneTimeCents: 10_000,
      recurringInterval: 'month',
      hasMixedRecurringIntervals: false,
    })
  })

  it('flags mixed monthly and yearly recurring rows', () => {
    const totals = computeBillingTotals([
      draft({ id: 'monthly', billingInterval: 'month' }),
      draft({ id: 'yearly', billingInterval: 'year' }),
    ])

    expect(totals.hasMixedRecurringIntervals).toBe(true)
  })
})

describe('draftToApiItem / draftsToApiItems', () => {
  it('maps a valid row, trimming and omitting empty description', () => {
    expect(draftToApiItem(draft({ label: '  Setup  ', amount: '20', quantity: '3' }))).toEqual({
      label: 'Setup',
      unitAmountCents: 2000,
      quantity: 3,
    })
  })

  it('includes a non-empty description', () => {
    expect(
      draftToApiItem(draft({ description: '  Tax Analysis  \n\n  Bookkeeping  ' }))?.description
    ).toBe('Tax Analysis\nBookkeeping')
  })

  it('normalizes pasted multiline labels as a single item name', () => {
    expect(
      draftToApiItem(
        draft({
          label: '  Bookkeeping  \n\n  Audit tax \n Paperwork cleanup  ',
        })
      )?.label
    ).toBe('Bookkeeping Audit tax Paperwork cleanup')
  })

  it('returns null when any row is invalid', () => {
    expect(draftsToApiItems([draft({}), draft({ amount: 'oops' })])).toBeNull()
  })
})

describe('draftsToCoreBillingPayload', () => {
  it('submits all-one-time rows as one-time primary items', () => {
    expect(draftsToCoreBillingPayload([draft({ label: 'Setup', amount: '20' })])).toEqual({
      billingInterval: 'one_time',
      items: [{ label: 'Setup', unitAmountCents: 2000, quantity: 1 }],
    })
  })

  it('splits mixed monthly and one-time rows into recurring items plus oneTimeItems', () => {
    expect(
      draftsToCoreBillingPayload([
        draft({ id: 'setup', label: 'Setup', amount: '100', billingInterval: 'one_time' }),
        draft({ id: 'retainer', label: 'Retainer', amount: '50', billingInterval: 'month' }),
      ])
    ).toEqual({
      billingInterval: 'month',
      items: [{ label: 'Retainer', unitAmountCents: 5000, quantity: 1 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })
  })

  it('rejects mixed monthly and yearly recurring rows', () => {
    expect(
      draftsToCoreBillingPayload([
        draft({ id: 'monthly', billingInterval: 'month' }),
        draft({ id: 'yearly', billingInterval: 'year' }),
      ])
    ).toBeNull()
  })
})

describe('payment template conversion helpers', () => {
  it('saves valid draft rows without discount fields', () => {
    expect(
      draftsToTemplatePayload([
        draft({ id: 'setup', label: 'Setup', amount: '100', billingInterval: 'one_time' }),
        draft({ id: 'retainer', label: 'Retainer', amount: '50', billingInterval: 'month' }),
      ])
    ).toEqual({
      billingInterval: 'month',
      items: [{ label: 'Retainer', unitAmountCents: 5000, quantity: 1 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })
  })

  it('loads template payloads into editable draft rows with fresh ids', () => {
    const drafts = templatePayloadToDrafts({
      billingInterval: 'month',
      items: [{ label: 'Retainer', description: 'monthly', unitAmountCents: 5000, quantity: 2 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })

    expect(drafts).toMatchObject([
      {
        label: 'Setup',
        description: '',
        amount: '100.00',
        quantity: '1',
        billingInterval: 'one_time',
      },
      {
        label: 'Retainer',
        description: 'monthly',
        amount: '50.00',
        quantity: '2',
        billingInterval: 'month',
      },
    ])
    expect(drafts[0].id).not.toBe(drafts[1].id)
  })
})
