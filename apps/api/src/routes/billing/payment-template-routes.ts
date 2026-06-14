import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { strictRateLimit } from '../../middleware/rate-limiter'
import { authMiddleware, requireOrg, requireOrgAdmin, type AuthVariables } from '../../middleware/auth'
import { CheckoutQuoteError } from '../../services/stripe'
import {
  archivePaymentTemplate,
  createPaymentTemplate,
  listPaymentTemplates,
  PaymentTemplateError,
  updatePaymentTemplate,
} from '../../services/payments/payment-template-service'
import { getVerifiedAuth } from '../leads/auth-helpers'
import {
  createPaymentTemplateSchema,
  paymentTemplateIdParamSchema,
  updatePaymentTemplateSchema,
} from './schemas'

const paymentTemplateRoute = new Hono<{ Variables: AuthVariables }>()

type ValidationResult =
  | { success: true }
  | {
      success: false
      error: { errors: Array<{ path: Array<string | number>; message: string }> }
    }

paymentTemplateRoute.get(
  '/payment-templates',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      const templates = await listPaymentTemplates(orgId)
      return c.json({ templates })
    } catch (error) {
      return handlePaymentTemplateError(c, error)
    }
  },
)

paymentTemplateRoute.post(
  '/payment-templates',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('json', createPaymentTemplateSchema, paymentTemplateValidationHook),
  async (c) => {
    try {
      const { orgId, staffId } = getVerifiedAuth(c.get('user'))
      const template = await createPaymentTemplate(c.req.valid('json'), {
        organizationId: orgId,
        staffId,
      })
      return c.json({ template }, 201)
    } catch (error) {
      return handlePaymentTemplateError(c, error)
    }
  },
)

paymentTemplateRoute.patch(
  '/payment-templates/:id',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('param', paymentTemplateIdParamSchema),
  zValidator('json', updatePaymentTemplateSchema, paymentTemplateValidationHook),
  async (c) => {
    try {
      const { orgId, staffId } = getVerifiedAuth(c.get('user'))
      const { id } = c.req.valid('param')
      const template = await updatePaymentTemplate(id, c.req.valid('json'), {
        organizationId: orgId,
        staffId,
      })
      return c.json({ template })
    } catch (error) {
      return handlePaymentTemplateError(c, error)
    }
  },
)

paymentTemplateRoute.delete(
  '/payment-templates/:id',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  strictRateLimit,
  zValidator('param', paymentTemplateIdParamSchema),
  async (c) => {
    try {
      const { orgId, staffId } = getVerifiedAuth(c.get('user'))
      const { id } = c.req.valid('param')
      const template = await archivePaymentTemplate(id, {
        organizationId: orgId,
        staffId,
      })
      return c.json({ template })
    } catch (error) {
      return handlePaymentTemplateError(c, error)
    }
  },
)

function handlePaymentTemplateError(c: Context, error: unknown) {
  if (error instanceof PaymentTemplateError) {
    return c.json({ error: error.code, message: error.message }, error.status)
  }
  if (error instanceof CheckoutQuoteError) {
    return c.json({ error: 'INVALID_QUOTE', message: error.message }, 400)
  }
  throw error
}

function paymentTemplateValidationHook(result: ValidationResult, c: Context) {
  if (result.success) return
  return c.json(
    {
      error: 'VALIDATION_ERROR',
      message: 'Invalid payment template payload',
      details: result.error.errors.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    400,
  )
}

export { paymentTemplateRoute }
