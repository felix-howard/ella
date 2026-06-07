/**
 * Tests for the public (payToken-protected) deposit pay endpoints.
 * Covers: 404 for unknown tokens, 409 for already-paid, per-token rate
 * limiting on checkout creation with slot refund on server-side failure,
 * and that the request body can never influence the charged amount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'

const svcMocks = vi.hoisted(() => ({
  getPublicPaymentView: vi.fn(),
  createDepositCheckoutSession: vi.fn(),
}))

// Stub the service module with a real error class so the route's
// `instanceof DepositCheckoutError` checks keep working.
vi.mock('../../../services/payments/deposit-checkout-service', () => {
  class DepositCheckoutError extends Error {
    constructor(
      readonly code: 'ALREADY_PAID' | 'NOT_PAYABLE' | 'STRIPE_MISSING_URL',
      message: string,
    ) {
      super(message)
      this.name = 'DepositCheckoutError'
    }
  }
  return { ...svcMocks, DepositCheckoutError }
})

import { DepositCheckoutError } from '../../../services/payments/deposit-checkout-service'
import { CHECKOUT_MAX_ATTEMPTS, publicPaymentsRoute } from '../public-payment-handlers'

function createApp() {
  const app = new Hono()
  app.route('/public/pay', publicPaymentsRoute)
  return app
}

// Unique token per test — the real in-memory rate limiter is shared.
let tokenCounter = 0
function freshToken() {
  return `tok_route_test_${++tokenCounter}`.padEnd(20, 'x')
}

const paymentView = {
  amount: '300',
  currency: 'usd',
  description: 'Retainer – 2026 Engagement Letter',
  status: 'PENDING',
  clientFirstName: 'Anna',
  organizationName: 'Acme Tax',
  paidAt: null,
}

afterEach(() => {
  __resetRateLimitMapForTests()
})

beforeEach(() => {
  vi.clearAllMocks()
  svcMocks.getPublicPaymentView.mockResolvedValue(paymentView)
  svcMocks.createDepositCheckoutSession.mockResolvedValue({
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_dep_123',
  })
})

describe('GET /public/pay/:payToken', () => {
  it('returns the public payment view', async () => {
    const token = freshToken()
    const res = await createApp().request(`/public/pay/${token}`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: paymentView })
    expect(svcMocks.getPublicPaymentView).toHaveBeenCalledWith(token)
  })

  it('returns 404 for an unknown payToken', async () => {
    svcMocks.getPublicPaymentView.mockResolvedValue(null)

    const res = await createApp().request(`/public/pay/${freshToken()}`)

    expect(res.status).toBe(404)
  })

  it('rejects tokens that fail param validation', async () => {
    const res = await createApp().request('/public/pay/short')

    expect(res.status).toBe(400)
    expect(svcMocks.getPublicPaymentView).not.toHaveBeenCalled()
  })
})

describe('POST /public/pay/:payToken/checkout', () => {
  it('creates a checkout session and returns its URL', async () => {
    const token = freshToken()
    const res = await createApp().request(`/public/pay/${token}/checkout`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_dep_123' },
    })
    // Token is the ONLY input — amount/currency always come from the DB row.
    expect(svcMocks.createDepositCheckoutSession).toHaveBeenCalledWith(token)
  })

  it('ignores any client-supplied amount in the request body', async () => {
    const token = freshToken()
    const res = await createApp().request(`/public/pay/${token}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: '0.01', currency: 'vnd' }),
    })

    expect(res.status).toBe(200)
    expect(svcMocks.createDepositCheckoutSession).toHaveBeenCalledTimes(1)
    expect(svcMocks.createDepositCheckoutSession).toHaveBeenCalledWith(token)
  })

  it('returns 409 with the error code for an already-paid payment', async () => {
    svcMocks.createDepositCheckoutSession.mockRejectedValue(
      new DepositCheckoutError('ALREADY_PAID', 'This payment has already been completed'),
    )

    const res = await createApp().request(`/public/pay/${freshToken()}/checkout`, {
      method: 'POST',
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ success: false, error: 'ALREADY_PAID' })
  })

  it('returns 404 for an unknown payToken', async () => {
    svcMocks.createDepositCheckoutSession.mockResolvedValue(null)

    const res = await createApp().request(`/public/pay/${freshToken()}/checkout`, {
      method: 'POST',
    })

    expect(res.status).toBe(404)
  })

  it('returns 502 when Stripe returns no checkout URL', async () => {
    svcMocks.createDepositCheckoutSession.mockRejectedValue(
      new DepositCheckoutError('STRIPE_MISSING_URL', 'Stripe did not return a Checkout URL'),
    )

    const res = await createApp().request(`/public/pay/${freshToken()}/checkout`, {
      method: 'POST',
    })

    expect(res.status).toBe(502)
  })

  it('rate limits checkout creation per token after max attempts', async () => {
    const token = freshToken()
    const app = createApp()

    for (let i = 0; i < CHECKOUT_MAX_ATTEMPTS; i++) {
      const res = await app.request(`/public/pay/${token}/checkout`, { method: 'POST' })
      expect(res.status).toBe(200)
    }

    const limited = await app.request(`/public/pay/${token}/checkout`, { method: 'POST' })
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ error: 'RATE_LIMIT_EXCEEDED' })
    expect(svcMocks.createDepositCheckoutSession).toHaveBeenCalledTimes(CHECKOUT_MAX_ATTEMPTS)

    // A different token has its own bucket.
    const other = await app.request(`/public/pay/${freshToken()}/checkout`, { method: 'POST' })
    expect(other.status).toBe(200)
  })

  it('refunds the rate-limit slot on server-side failures so retries work', async () => {
    const token = freshToken()
    const app = createApp()
    svcMocks.createDepositCheckoutSession.mockRejectedValue(new Error('stripe outage'))

    // Burn through more than the attempt cap with failing calls...
    for (let i = 0; i < CHECKOUT_MAX_ATTEMPTS + 2; i++) {
      const res = await app.request(`/public/pay/${token}/checkout`, { method: 'POST' })
      expect(res.status).toBe(500)
    }

    // ...the slot was refunded each time, so a recovered retry still succeeds.
    svcMocks.createDepositCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_dep_retry',
    })
    const res = await app.request(`/public/pay/${token}/checkout`, { method: 'POST' })
    expect(res.status).toBe(200)
  })
})
