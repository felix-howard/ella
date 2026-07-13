import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'

const svcMocks = vi.hoisted(() => ({
  getPublicQuoteView: vi.fn(),
  createQuoteCheckoutSession: vi.fn(),
}))

vi.mock('../../../services/payments/quote-checkout-service', () => {
  class QuoteCheckoutError extends Error {
    constructor(
      readonly code:
        | 'ALREADY_PAID'
        | 'NOT_PAYABLE'
        | 'PAYMENT_PROCESSING'
        | 'STRIPE_MISSING_URL',
      message: string,
      readonly publicPaymentState: unknown = null
    ) {
      super(message)
      this.name = 'QuoteCheckoutError'
    }
  }
  return { ...svcMocks, QuoteCheckoutError }
})

import { QuoteCheckoutError } from '../../../services/payments/quote-checkout-service'
import { publicQuotesRoute } from '../public-quote-handlers'

function createApp() {
  const app = new Hono()
  app.route('/public/quote', publicQuotesRoute)
  return app
}

let tokenCounter = 0
function freshToken() {
  return `tok_quote_route_${++tokenCounter}`.padEnd(20, 'x')
}

const quoteView = {
  orgName: 'Acme Tax',
  recipientFirstName: 'Anna',
  lineItems: [],
  monthlyTotal: 0,
  setupTotal: 500,
  subtotal: 500,
  discount: null,
  billingInterval: null,
  dueToday: 500,
  status: 'sent',
  paidAt: null,
  publicPaymentState: {
    state: 'payable',
    paymentMethodFamily: 'unknown',
    processingExplanationKey: null,
    mayStartCheckout: true,
    timestamps: {
      latestCheckoutSessionCreatedAt: null,
      latestCheckoutSessionUpdatedAt: null,
      latestCheckoutSessionExpiresAt: null,
      latestStripeEventAt: null,
      paidAt: null,
    },
  },
}

afterEach(() => {
  __resetRateLimitMapForTests()
})

beforeEach(() => {
  vi.clearAllMocks()
  svcMocks.getPublicQuoteView.mockResolvedValue(quoteView)
  svcMocks.createQuoteCheckoutSession.mockResolvedValue({
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_quote_123',
  })
})

describe('public quote checkout handlers', () => {
  it('returns 202 with public state when a bank payment is processing', async () => {
    const publicPaymentState = {
      ...quoteView.publicPaymentState,
      state: 'processing_bank_payment',
      paymentMethodFamily: 'bank',
      processingExplanationKey: 'ach_bank_payment_settlement',
      mayStartCheckout: false,
    } as const
    svcMocks.createQuoteCheckoutSession.mockRejectedValue(
      new QuoteCheckoutError(
        'PAYMENT_PROCESSING',
        'This bank payment has been submitted and is still processing',
        publicPaymentState
      )
    )

    const res = await createApp().request(`/public/quote/${freshToken()}/checkout`, {
      method: 'POST',
    })

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({
      success: false,
      error: 'PAYMENT_PROCESSING',
      message: 'This bank payment has been submitted and is still processing',
      data: { publicPaymentState },
    })
  })
})
