import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { strictRateLimit } from '../../middleware/rate-limiter'
import { authMiddleware, requireOrg, requireOrgAdmin, type AuthVariables } from '../../middleware/auth'
import { CheckoutQuoteError, createCheckoutSession } from '../../services/stripe'
import { createCustomCheckoutSession } from '../../services/stripe/custom-checkout'
import { createSendableQuote } from '../../services/payments/quote-send-service'
import { createSendableCustomQuote } from '../../services/payments/custom-quote-send-service'
import { getVerifiedAuth } from '../leads/auth-helpers'
import {
  createCheckoutSessionSchema,
  createCustomCheckoutSchema,
  type CheckoutPricingInput,
  sendCustomQuoteSchema,
  sendQuoteInputSchema,
} from './schemas'
import { paymentTemplateRoute } from './payment-template-routes'

const billingRoute = new Hono<{ Variables: AuthVariables }>()

billingRoute.post(
  '/checkout-sessions',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('json', createCheckoutSessionSchema),
  async (c) => {
    try {
      const input = c.req.valid('json')
      assertNoCalculatorBusinessTaxPrepay(input.pricingInput)
      const user = c.get('user')
      const result = await createCheckoutSession(input, {
        organizationId: user.organizationId,
        createdByStaffId: user.staffId,
      })
      return c.json(result)
    } catch (error) {
      return handleBillingError(c, error)
    }
  }
)

billingRoute.post(
  '/checkout-sessions/custom',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('json', createCustomCheckoutSchema),
  async (c) => {
    try {
      const user = c.get('user')
      const result = await createCustomCheckoutSession(c.req.valid('json'), {
        organizationId: user.organizationId,
        createdByStaffId: user.staffId,
      })
      return c.json(result)
    } catch (error) {
      return handleBillingError(c, error)
    }
  }
)

billingRoute.post(
  '/quotes/send',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('json', sendQuoteInputSchema),
  async (c) => {
    try {
      const input = c.req.valid('json')
      assertNoCalculatorBusinessTaxPrepay(input.pricingInput)
      const { orgId, staffId } = getVerifiedAuth(c.get('user'))
      const result = await createSendableQuote(input, {
        organizationId: orgId,
        staffId,
      })
      return c.json(result)
    } catch (error) {
      return handleBillingError(c, error)
    }
  }
)

billingRoute.post(
  '/quotes/send/custom',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('json', sendCustomQuoteSchema),
  async (c) => {
    try {
      const { orgId, staffId } = getVerifiedAuth(c.get('user'))
      const result = await createSendableCustomQuote(c.req.valid('json'), {
        organizationId: orgId,
        staffId,
      })
      return c.json(result)
    } catch (error) {
      return handleBillingError(c, error)
    }
  }
)

billingRoute.route('/', paymentTemplateRoute)

/** Map billing/Stripe errors to stable codes; rethrow anything unrecognized. */
function handleBillingError(c: Context, error: unknown) {
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

function assertNoCalculatorBusinessTaxPrepay(pricingInput: CheckoutPricingInput): void {
  if (pricingInput.oneTime.businessTaxReturn <= 0) return
  throw new CheckoutQuoteError(
    'Business tax return yearly pre-pay must be created through Custom link'
  )
}

export { billingRoute }
