/**
 * Org-level agreement template CRUD endpoints. Mounted on `/agreement-templates`.
 * All routes require an authenticated staff member. Mutations additionally
 * require org-admin role; reads require only authentication.
 *
 * Org isolation is enforced inside the service layer (`template-ops.ts`):
 * every query is scoped by `organizationId` from the JWT, so a staff member
 * cannot fetch another org's templates even via crafted IDs.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware, requireAdminOrManager } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  archiveTemplate,
  unarchiveTemplate,
} from '../../services/agreement-templates/template-ops'
import {
  idParamSchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  listQuerySchema,
} from './schemas'

const agreementTemplatesRoute = new Hono<{ Variables: AuthVariables }>()

// All routes require authentication; per-route org-admin gate is added below
// for mutations only (read endpoints are open to any authenticated staff).
agreementTemplatesRoute.use('*', authMiddleware)

function getAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// GET /agreement-templates — list templates for the org.
// Query: ?type=NDA&includeArchived=true
agreementTemplatesRoute.get(
  '/',
  zValidator('query', listQuerySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { type, includeArchived } = c.req.valid('query')
    const data = await listTemplates({ orgId, type, includeArchived })
    return c.json({ success: true, data })
  },
)

// GET /agreement-templates/:id — fetch a single template.
agreementTemplatesRoute.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const data = await getTemplate({ orgId, id })
    return c.json({ success: true, data })
  },
)

// POST /agreement-templates — create a new template (org-admin only).
agreementTemplatesRoute.post(
  '/',
  requireAdminOrManager,
  zValidator('json', createTemplateBodySchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const body = c.req.valid('json')
    const data = await createTemplate({
      orgId,
      staffId,
      name: body.name,
      type: body.type,
      contentHtml: body.contentHtml,
      defaultDepositAmount: body.defaultDepositAmount ?? null,
    })
    return c.json({ success: true, data }, 201)
  },
)

// PATCH /agreement-templates/:id — partial update (org-admin only).
agreementTemplatesRoute.patch(
  '/:id',
  requireAdminOrManager,
  zValidator('param', idParamSchema),
  zValidator('json', updateTemplateBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const data = await updateTemplate({ orgId, id, ...body })
    return c.json({ success: true, data })
  },
)

// POST /agreement-templates/:id/archive — soft-delete (org-admin only).
// Soft-archive preserves Agreement.templateId FKs on historical sends.
agreementTemplatesRoute.post(
  '/:id/archive',
  requireAdminOrManager,
  zValidator('param', idParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const data = await archiveTemplate({ orgId, id })
    return c.json({ success: true, data })
  },
)

// POST /agreement-templates/:id/unarchive — restore (org-admin only).
agreementTemplatesRoute.post(
  '/:id/unarchive',
  requireAdminOrManager,
  zValidator('param', idParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { id } = c.req.valid('param')
    const data = await unarchiveTemplate({ orgId, id })
    return c.json({ success: true, data })
  },
)

export { agreementTemplatesRoute }
