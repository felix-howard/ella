import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from './api-client'

vi.mock('./i18n', () => ({
  default: {
    t: (key: string) => key,
  },
}))

import {
  getQuotePaymentStateFromError,
  isQuotePaymentProcessingError,
  quoteApi,
} from './quote-api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('quoteApi', () => {
  it('turns a 202 processing-bank response into an ApiError with public state details', async () => {
    const publicPaymentState = {
      state: 'processing_bank_payment',
      paymentMethodFamily: 'bank',
      processingExplanationKey: 'ach_bank_payment_settlement',
      mayStartCheckout: false,
      timestamps: {
        latestCheckoutSessionCreatedAt: '2026-07-01T09:55:00.000Z',
        latestCheckoutSessionUpdatedAt: '2026-07-01T10:00:00.000Z',
        latestCheckoutSessionExpiresAt: '2026-07-02T09:55:00.000Z',
        latestStripeEventAt: '2026-07-01T10:00:00.000Z',
        paidAt: null,
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: 'PAYMENT_PROCESSING',
            message: 'This bank payment has been submitted and is still processing',
            data: { publicPaymentState },
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    )

    try {
      await quoteApi.createCheckout('tok_quote_test')
      throw new Error('Expected createCheckout to throw')
    } catch (error) {
      expect(error).toMatchObject({
        status: 202,
        code: 'PAYMENT_PROCESSING',
        details: { publicPaymentState },
      } satisfies Partial<ApiError>)
      expect(isQuotePaymentProcessingError(error)).toBe(true)
      expect(getQuotePaymentStateFromError(error)).toEqual(publicPaymentState)
    }
  })
})
