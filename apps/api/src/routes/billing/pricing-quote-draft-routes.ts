import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { pricingQuoteDraftWriteRateLimit } from '../../middleware/rate-limiter'
import {
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  type AuthVariables,
} from '../../middleware/auth'
import {
  createPricingQuoteDraft,
  deletePricingQuoteDraft,
  getPricingQuoteDraft,
  listPricingQuoteDrafts,
  PricingQuoteDraftError,
  updatePricingQuoteDraft,
} from '../../services/payments/pricing-quote-draft-service'
import { getVerifiedAuth } from '../leads/auth-helpers'
import {
  createPricingQuoteDraftSchema,
  pricingQuoteDraftDeleteQuerySchema,
  pricingQuoteDraftIdParamSchema,
  updatePricingQuoteDraftSchema,
} from './schemas'

const pricingQuoteDraftRoute = new Hono<{ Variables: AuthVariables }>()

type ValidationResult =
  | { success: true }
  | {
      success: false
      error: { errors: Array<{ path: Array<string | number>; message: string }> }
    }

pricingQuoteDraftRoute.get(
  '/quote-drafts',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      return c.json({ drafts: await listPricingQuoteDrafts(orgId) })
    } catch (error) {
      return handlePricingQuoteDraftError(c, error)
    }
  }
)

pricingQuoteDraftRoute.post(
  '/quote-drafts',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  pricingQuoteDraftWriteRateLimit,
  zValidator('json', createPricingQuoteDraftSchema, pricingQuoteDraftValidationHook),
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      return c.json({ draft: await createPricingQuoteDraft(c.req.valid('json'), orgId) }, 201)
    } catch (error) {
      return handlePricingQuoteDraftError(c, error)
    }
  }
)

pricingQuoteDraftRoute.get(
  '/quote-drafts/:id',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  zValidator('param', pricingQuoteDraftIdParamSchema),
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      return c.json({ draft: await getPricingQuoteDraft(c.req.valid('param').id, orgId) })
    } catch (error) {
      return handlePricingQuoteDraftError(c, error)
    }
  }
)

pricingQuoteDraftRoute.patch(
  '/quote-drafts/:id',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  pricingQuoteDraftWriteRateLimit,
  zValidator('param', pricingQuoteDraftIdParamSchema),
  zValidator('json', updatePricingQuoteDraftSchema, pricingQuoteDraftValidationHook),
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      const draft = await updatePricingQuoteDraft(
        c.req.valid('param').id,
        c.req.valid('json'),
        orgId
      )
      return c.json({ draft })
    } catch (error) {
      return handlePricingQuoteDraftError(c, error)
    }
  }
)

pricingQuoteDraftRoute.delete(
  '/quote-drafts/:id',
  authMiddleware,
  requireOrg,
  requireOrgAdmin,
  pricingQuoteDraftWriteRateLimit,
  zValidator('param', pricingQuoteDraftIdParamSchema),
  zValidator('query', pricingQuoteDraftDeleteQuerySchema),
  async (c) => {
    try {
      const { orgId } = getVerifiedAuth(c.get('user'))
      return c.json(
        await deletePricingQuoteDraft(
          c.req.valid('param').id,
          orgId,
          c.req.valid('query').expectedUpdatedAt
        )
      )
    } catch (error) {
      return handlePricingQuoteDraftError(c, error)
    }
  }
)

function handlePricingQuoteDraftError(c: Context, error: unknown) {
  if (error instanceof PricingQuoteDraftError) {
    return c.json({ error: error.code, message: error.message }, error.status)
  }
  throw error
}

function pricingQuoteDraftValidationHook(result: ValidationResult, c: Context) {
  if (result.success) return
  return c.json(
    {
      error: 'VALIDATION_ERROR',
      message: 'Invalid pricing quote draft payload',
      details: result.error.errors.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    400
  )
}

export { pricingQuoteDraftRoute }
