/**
 * Public sent-quote handlers — payToken-protected, no Clerk auth.
 * Mounted on `/public/quote` (see app.ts), consumed by the portal quote page.
 *
 * Clone of public-payment-handlers but backed by `PaymentQuote`. Checkout-session
 * creation carries a per-token rate limit (reusing the deposit window/attempts)
 * so a stolen token can't spam Stripe sessions. The rate-limit slot is only kept
 * when a session is actually created — any failure refunds the slot so legit
 * retries aren't locked out by server-side errors.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { checkRateLimit, releaseRateLimit } from '../../middleware/rate-limiter'
import { CHECKOUT_WINDOW_MS, CHECKOUT_MAX_ATTEMPTS } from './public-payment-handlers'
import {
  getPublicQuoteView,
  createQuoteCheckoutSession,
  QuoteCheckoutError,
} from '../../services/payments/quote-checkout-service'

const publicQuotesRoute = new Hono()

const payTokenParamSchema = z.object({
  payToken: z.string().min(10).max(64),
}).strict()

const perTokenCheckoutLimit = createMiddleware(async (c, next) => {
  const payToken = c.req.param('payToken') || 'unknown'
  if (!checkRateLimit(`quote-checkout:${payToken}`, CHECKOUT_WINDOW_MS, CHECKOUT_MAX_ATTEMPTS)) {
    return c.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many checkout attempts' },
      429,
    )
  }
  await next()
})

// GET /:payToken — itemized breakdown for the portal quote page
publicQuotesRoute.get(
  '/:payToken',
  zValidator('param', payTokenParamSchema),
  async (c) => {
    const { payToken } = c.req.valid('param')
    const view = await getPublicQuoteView(payToken)
    if (!view) throw new HTTPException(404, { message: 'Quote not found' })
    return c.json({ success: true, data: view })
  },
)

// POST /:payToken/checkout — create a fresh Stripe Checkout Session.
publicQuotesRoute.post(
  '/:payToken/checkout',
  perTokenCheckoutLimit,
  zValidator('param', payTokenParamSchema),
  async (c) => {
    const { payToken } = c.req.valid('param')
    try {
      const result = await createQuoteCheckoutSession(payToken)
      if (!result) {
        releaseRateLimit(`quote-checkout:${payToken}`)
        throw new HTTPException(404, { message: 'Quote not found' })
      }
      return c.json({ success: true, data: result })
    } catch (error) {
      if (!(error instanceof HTTPException)) {
        releaseRateLimit(`quote-checkout:${payToken}`)
      }
      if (error instanceof QuoteCheckoutError) {
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

export { publicQuotesRoute }
