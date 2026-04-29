/**
 * Staff-facing NDA handlers — mounted on `/leads`, so paths are relative
 * to `/leads/:leadId/nda/...`. All handlers require an authed staff member
 * with org-admin role; org scoping is enforced inside the service layer.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware, requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createNdaForLead,
  listNdasForLead,
  updateDeposit,
  getPresignedPdfUrl,
  resendNda,
  getDefaultHtmlForLead,
  renderPreviewPdf,
} from '../../services/nda/nda-service'
import {
  leadIdParamSchema,
  leadAndNdaIdParamSchema,
  updateDepositBodySchema,
  createNdaBodySchema,
  previewNdaBodySchema,
} from './schemas'

const staffRoute = new Hono<{ Variables: AuthVariables }>()

staffRoute.use('*', authMiddleware, requireOrgAdmin)

function getAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// POST /:leadId/nda — create NDA, generate token, send SMS
// Body is optional (defaults to template-rendered NDA). Pass `contentHtml` to
// snapshot a sanitized custom version on the row (immutable post-SENT).
staffRoute.post(
  '/:leadId/nda',
  zValidator('param', leadIdParamSchema),
  zValidator('json', createNdaBodySchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { nda, url } = await createNdaForLead({
      leadId,
      orgId,
      staffId,
      contentHtml: body.contentHtml,
    })
    return c.json({ success: true, data: nda, url }, 201)
  },
)

// GET /:leadId/nda/default-html — template-v1 rendered to HTML for editor seed
staffRoute.get(
  '/:leadId/nda/default-html',
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const data = await getDefaultHtmlForLead(leadId, orgId)
    return c.json({ success: true, data })
  },
)

// POST /:leadId/nda/preview-pdf — in-memory render of the (possibly-edited)
// NDA body. Streams `application/pdf` bytes; no DB write.
staffRoute.post(
  '/:leadId/nda/preview-pdf',
  zValidator('param', leadIdParamSchema),
  zValidator('json', previewNdaBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const buf = await renderPreviewPdf({
      entityType: 'lead',
      entityId: leadId,
      orgId,
      contentHtml: body.contentHtml,
    })
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="nda-preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  },
)

// GET /:leadId/nda — list NDAs for a lead
staffRoute.get(
  '/:leadId/nda',
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const data = await listNdasForLead(leadId, orgId)
    return c.json({ success: true, data })
  },
)

// PATCH /:leadId/nda/:id/deposit — update deposit state + note
staffRoute.patch(
  '/:leadId/nda/:id/deposit',
  zValidator('param', leadAndNdaIdParamSchema),
  zValidator('json', updateDepositBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updated = await updateDeposit({
      ndaId: id,
      leadId,
      orgId,
      status: body.depositStatus,
      note: body.depositNote ?? null,
      paidAt: body.depositPaidAt ? new Date(body.depositPaidAt) : null,
    })
    return c.json({ success: true, data: updated })
  },
)

// GET /:leadId/nda/:id/pdf — presigned R2 URL (15-min TTL)
staffRoute.get(
  '/:leadId/nda/:id/pdf',
  zValidator('param', leadAndNdaIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const url = await getPresignedPdfUrl({ ndaId: id, leadId, orgId })
    return c.json({ success: true, url })
  },
)

// POST /:leadId/nda/:id/resend — reuse token if active, rotate if expired
staffRoute.post(
  '/:leadId/nda/:id/resend',
  zValidator('param', leadAndNdaIdParamSchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const result = await resendNda({ ndaId: id, leadId, orgId, staffId })
    return c.json({
      success: true,
      data: result.nda,
      url: result.url,
      rotated: result.rotated,
    })
  },
)

export { staffRoute }
