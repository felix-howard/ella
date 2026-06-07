/**
 * Public deposit payment handlers — payToken-protected, no Clerk auth.
 * Mounted on `/public/pay` (see app.ts), consumed by the portal pay page.
 *
 * Checkout-session creation carries a per-token rate limit (same pattern as
 * the agreement sign endpoint) so a stolen token can't spam Stripe sessions.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { checkRateLimit, releaseRateLimit } from '../../middleware/rate-limiter'
import {
  getPublicPaymentView,
  createDepositCheckoutSession,
  DepositCheckoutError,
} from '../../services/payments/deposit-checkout-service'

const publicPaymentsRoute = new Hono()

export const CHECKOUT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
export const CHECKOUT_MAX_ATTEMPTS = 3

const payTokenParamSchema = z.object({
  payToken: z.string().min(10).max(64),
}).strict()

const perTokenCheckoutLimit = createMiddleware(async (c, next) => {
  const payToken = c.req.param('payToken') || 'unknown'
  if (!checkRateLimit(`payment-checkout:${payToken}`, CHECKOUT_WINDOW_MS, CHECKOUT_MAX_ATTEMPTS)) {
    return c.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many checkout attempts' },
      429,
    )
  }
  await next()
})

// GET /:payToken — minimal payment info for the portal pay page
publicPaymentsRoute.get(
  '/:payToken',
  zValidator('param', payTokenParamSchema),
  async (c) => {
    const { payToken } = c.req.valid('param')
    const view = await getPublicPaymentView(payToken)
    if (!view) throw new HTTPException(404, { message: 'Payment link not found' })
    return c.json({ success: true, data: view })
  },
)

// POST /:payToken/checkout — create a fresh Stripe Checkout Session.
// A rate-limit slot is only kept when a session is actually created — any
// failure (Stripe outage, already-paid, unknown token) refunds the slot so
// legitimate retries aren't locked out by server-side errors.
publicPaymentsRoute.post(
  '/:payToken/checkout',
  perTokenCheckoutLimit,
  zValidator('param', payTokenParamSchema),
  async (c) => {
    const { payToken } = c.req.valid('param')
    try {
      const result = await createDepositCheckoutSession(payToken)
      if (!result) {
        releaseRateLimit(`payment-checkout:${payToken}`)
        throw new HTTPException(404, { message: 'Payment link not found' })
      }
      return c.json({ success: true, data: result })
    } catch (error) {
      if (!(error instanceof HTTPException)) {
        releaseRateLimit(`payment-checkout:${payToken}`)
      }
      if (error instanceof DepositCheckoutError) {
        if (error.code === 'STRIPE_MISSING_URL') {
          throw new HTTPException(502, { message: error.message })
        }
        // ALREADY_PAID / NOT_PAYABLE
        return c.json({ success: false, error: error.code, message: error.message }, 409)
      }
      throw error
    }
  },
)

export { publicPaymentsRoute }
