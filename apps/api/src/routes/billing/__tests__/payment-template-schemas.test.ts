import { describe, expect, it } from 'vitest'
import { createPaymentTemplateSchema, paymentTemplateItemsSchema } from '../schemas'

const lineItem = { label: 'Bookkeeping', unitAmountCents: 50000, quantity: 1 }

describe('payment template schemas', () => {
  it('rejects one-time templates with one-time add-ons', () => {
    const result = createPaymentTemplateSchema.safeParse({
      name: 'Invalid one-time template',
      template: {
        billingInterval: 'one_time',
        items: [lineItem],
        oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
      },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['template', 'oneTimeItems'],
      message: 'oneTimeItems are only allowed on recurring (month/year) links',
    })
  })

  it('accepts recurring templates with one-time add-ons', () => {
    expect(
      paymentTemplateItemsSchema.safeParse({
        billingInterval: 'month',
        items: [lineItem],
        oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
      }).success
    ).toBe(true)
  })
})
