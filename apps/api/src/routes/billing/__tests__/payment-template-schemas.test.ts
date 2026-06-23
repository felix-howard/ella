import { describe, expect, it } from 'vitest'
import {
  createDefaultPricingInput,
  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY,
  MAX_CALCULATOR_CUSTOM_ITEMS,
  MAX_CALCULATOR_CUSTOM_LABEL_LENGTH,
} from '@ella/shared/pricing'
import {
  checkoutPricingInputSchema,
  createPaymentTemplateSchema,
  paymentTemplateItemsSchema,
} from '../schemas'

const lineItem = { label: 'Bookkeeping', unitAmountCents: 50000, quantity: 1 }
const calculatorCustomItem = {
  id: 'custom_1',
  label: 'Advisory add-on',
  amount: 100,
  quantity: 1,
  billingInterval: 'month',
} as const

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

describe('checkout pricing input schema', () => {
  it('defaults missing calculator custom items to an empty array', () => {
    const input = createDefaultPricingInput()
    delete (input as Partial<typeof input>).customItems

    const parsed = checkoutPricingInputSchema.parse(input)

    expect(parsed.customItems).toEqual([])
  })

  it('rejects yearly custom items in calculator checkout', () => {
    const result = checkoutPricingInputSchema.safeParse({
      ...createDefaultPricingInput(),
      customItems: [
        {
          id: 'custom_yearly',
          label: 'Annual advisory',
          amount: 100,
          quantity: 1,
          billingInterval: 'year',
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['customItems', 0, 'billingInterval'])
  })

  it.each([
    [
      'too many custom items',
      {
        customItems: Array.from({ length: MAX_CALCULATOR_CUSTOM_ITEMS + 1 }, (_, index) => ({
          ...calculatorCustomItem,
          id: `custom_${index}`,
        })),
      },
    ],
    ['blank custom label', { customItems: [{ ...calculatorCustomItem, label: '   ' }] }],
    [
      'overlong custom label',
      {
        customItems: [
          { ...calculatorCustomItem, label: 'x'.repeat(MAX_CALCULATOR_CUSTOM_LABEL_LENGTH + 1) },
        ],
      },
    ],
    ['zero custom amount', { customItems: [{ ...calculatorCustomItem, amount: 0 }] }],
    [
      'over-max custom amount',
      { customItems: [{ ...calculatorCustomItem, amount: MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT + 1 }] },
    ],
    ['zero custom quantity', { customItems: [{ ...calculatorCustomItem, quantity: 0 }] }],
    [
      'over-max custom quantity',
      {
        customItems: [
          { ...calculatorCustomItem, quantity: MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY + 1 },
        ],
      },
    ],
  ])('rejects %s', (_name, override) => {
    const result = checkoutPricingInputSchema.safeParse({
      ...createDefaultPricingInput(),
      ...override,
    })

    expect(result.success).toBe(false)
  })
})
