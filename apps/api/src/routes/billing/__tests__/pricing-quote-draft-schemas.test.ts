import { describe, expect, it } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import {
  checkoutPricingInputSchema,
  createCheckoutSessionSchema,
  createPricingQuoteDraftSchema,
  sendQuoteInputSchema,
  updatePricingQuoteDraftSchema,
} from '../schemas'

describe('pricing quote draft schemas', () => {
  it('accepts incomplete custom rows for draft persistence only', () => {
    const pricingInput = {
      ...createDefaultPricingInput(),
      customItems: [
        {
          id: 'custom_1',
          label: '',
          amount: 0,
          quantity: 0,
          billingInterval: 'one_time' as const,
        },
      ],
    }

    expect(
      createPricingQuoteDraftSchema.safeParse({ name: ' In progress ', pricingInput }).success
    ).toBe(true)
    expect(checkoutPricingInputSchema.safeParse(pricingInput).success).toBe(false)
  })

  it('requires a name for create and a concurrency token plus an edit for update', () => {
    const pricingInput = createDefaultPricingInput()

    expect(createPricingQuoteDraftSchema.safeParse({ name: ' ', pricingInput }).success).toBe(false)
    expect(
      updatePricingQuoteDraftSchema.safeParse({
        expectedUpdatedAt: '2026-09-08T12:00:00.000Z',
      }).success
    ).toBe(false)
    expect(
      updatePricingQuoteDraftSchema.safeParse({
        name: 'Renamed',
        expectedUpdatedAt: 'not-a-date',
      }).success
    ).toBe(false)
  })

  it('rejects unsafe draft custom-item bounds', () => {
    const pricingInput = {
      ...createDefaultPricingInput(),
      customItems: [
        {
          id: 'custom_1',
          label: '',
          amount: -1,
          quantity: 0,
          billingInterval: 'one_time' as const,
        },
      ],
    }

    expect(createPricingQuoteDraftSchema.safeParse({ name: 'Draft', pricingInput }).success).toBe(
      false
    )
  })

  it('accepts paired draft id/version only on Calculator final actions', () => {
    const pricingInput = createDefaultPricingInput()
    expect(
      createCheckoutSessionSchema.safeParse({
        pricingInput,
        draftId: 'draft_1',
        draftUpdatedAt: '2026-09-08T10:00:00.000Z',
      }).success
    ).toBe(true)
    expect(
      sendQuoteInputSchema.safeParse({
        pricingInput,
        recipient: { type: 'client', id: 'client_1' },
        draftId: 'draft_1',
        draftUpdatedAt: '2026-09-08T10:00:00.000Z',
      }).success
    ).toBe(true)
    expect(createCheckoutSessionSchema.safeParse({ pricingInput, draftId: '' }).success).toBe(false)
    expect(
      createCheckoutSessionSchema.safeParse({ pricingInput, draftId: 'draft_1' }).success
    ).toBe(false)
  })
})
