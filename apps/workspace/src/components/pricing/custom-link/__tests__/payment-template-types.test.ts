import { describe, expect, it } from 'vitest'
import { draftsToCoreBillingPayload } from '../custom-link-types'
import type { CustomItemDraft } from '../custom-link-types'
import {
  draftsToTemplatePayload,
  loadedTemplateToCustomLinkState,
  templatePayloadToDrafts,
} from '../custom-link-template-conversion'

function draft(overrides: Partial<CustomItemDraft>): CustomItemDraft {
  return {
    id: 'draft',
    label: 'Item',
    description: '',
    amount: '10',
    quantity: '1',
    billingInterval: 'one_time',
    ...overrides,
  }
}

describe('payment template conversion helpers', () => {
  it('round-trips monthly templates with one-time add-ons', () => {
    const payload = draftsToTemplatePayload([
      draft({ id: 'setup', label: 'Setup', amount: '125', billingInterval: 'one_time' }),
      draft({
        id: 'monthly',
        label: 'Monthly books',
        description: 'Close books',
        amount: '300',
        quantity: '2',
        billingInterval: 'month',
      }),
    ])

    expect(payload).toEqual({
      billingInterval: 'month',
      items: [
        {
          label: 'Monthly books',
          description: 'Close books',
          unitAmountCents: 30000,
          quantity: 2,
        },
      ],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 12500, quantity: 1 }],
    })
    expect(draftsToTemplatePayload(templatePayloadToDrafts(payload!))).toEqual(payload)
  })

  it('generates non-empty unique draft ids when loading a template', () => {
    const drafts = templatePayloadToDrafts({
      billingInterval: 'year',
      items: [
        { label: 'Tax planning', unitAmountCents: 120000, quantity: 1 },
        { label: 'Advisory', unitAmountCents: 50000, quantity: 1 },
      ],
    })

    expect(drafts.map((item) => item.id)).toHaveLength(2)
    expect(drafts.every((item) => item.id.length > 0)).toBe(true)
    expect(new Set(drafts.map((item) => item.id)).size).toBe(2)
  })

  it('excludes coupon and promotion fields from save payloads', () => {
    const payload = draftsToTemplatePayload([
      draft({ label: 'Setup', amount: '100', billingInterval: 'one_time' }),
    ])

    expect(payload).toEqual({
      billingInterval: 'one_time',
      items: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })
    expect(payload).not.toHaveProperty('couponId')
    expect(payload).not.toHaveProperty('allowPromotionCodes')
  })

  it('loads templates as normal editable rows and resets discounts', () => {
    const nextState = loadedTemplateToCustomLinkState({
      billingInterval: 'month',
      items: [{ label: 'Retainer', unitAmountCents: 50000, quantity: 1 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })
    const editedRows = nextState.items.map((item) =>
      item.label === 'Retainer' ? { ...item, amount: '75', quantity: '2' } : item
    )

    expect(nextState.discountMode).toBe('none')
    expect(nextState.couponId).toBe('')
    expect(draftsToCoreBillingPayload(editedRows)).toEqual({
      billingInterval: 'month',
      items: [{ label: 'Retainer', unitAmountCents: 7500, quantity: 2 }],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
    })
  })
})
