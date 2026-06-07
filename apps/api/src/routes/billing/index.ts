import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { strictRateLimit } from '../../middleware/rate-limiter'
import { authMiddleware, requireOrg, requireAdminOrManager, type AuthVariables } from '../../middleware/auth'
import { CheckoutQuoteError, createCheckoutSession } from '../../services/stripe'
import { createCheckoutSessionSchema } from './schemas'

const billingRoute = new Hono<{ Variables: AuthVariables }>()

billingRoute.post(
  '/checkout-sessions',
  authMiddleware,
  requireOrg,
  requireAdminOrManager,
  strictRateLimit,
  zValidator('json', createCheckoutSessionSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const result = await createCheckoutSession(c.req.valid('json'), {
        organizationId: user.organizationId,
        createdByStaffId: user.staffId,
      })
      return c.json(result)
    } catch (error) {
      if (error instanceof CheckoutQuoteError) {
        return c.json({ error: 'INVALID_QUOTE', message: error.message }, 400)
      }
      if (error instanceof Error && error.message === 'Stripe is not configured') {
        return c.json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured' }, 503)
      }
      if (
        error instanceof Error &&
        error.message === 'Stripe production return URLs must be valid HTTPS URLs'
      ) {
        return c.json({ error: 'STRIPE_RETURN_URLS_INVALID', message: error.message }, 503)
      }
      throw error
    }
  }
)

export { billingRoute }
