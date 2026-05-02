/**
 * Staff-facing agreement handlers — mounted on `/leads`, so paths are relative
 * to `/leads/:leadId/agreements/...`. All handlers require an authed staff
 * member with org-admin role; org scoping is enforced inside the service layer.
 *
 * Phase 06 will add `/leads/:leadId/nda/...` aliases for backward compat with
 * older portal links and embedded API consumers.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createAgreementForEntity,
  listAgreementsForEntity,
  updateDepositForEntity,
  getPresignedPdfUrlForEntity,
  resendAgreementForEntity,
  getDefaultHtmlForEntity,
  renderPreviewPdf,
} from '../../services/agreements/agreement-service'
import {
  agreementTypeSchema,
  leadIdParamSchema,
  leadAndAgreementIdParamSchema,
  updateDepositBodySchema,
  createAgreementBodySchema,
  previewAgreementBodySchema,
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

const listQuerySchema = z.object({ type: agreementTypeSchema.optional() }).strict()

// POST /:leadId/agreements — create agreement, generate token, send SMS.
// Body accepts type, title, contentHtml, templateId, depositAmount.
staffRoute.post(
  '/:leadId/agreements',
  zValidator('param', leadIdParamSchema),
  zValidator('json', createAgreementBodySchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { agreement, url } = await createAgreementForEntity({
      entityType: 'lead',
      entityId: leadId,
      orgId,
      staffId,
      type: body.type,
      title: body.title,
      contentHtml: body.contentHtml,
      templateId: body.templateId,
      depositAmount: body.depositAmount ?? null,
      internalNote: body.internalNote,
    })
    return c.json({ success: true, data: agreement, url }, 201)
  },
)

// GET /:leadId/agreements/default-html — built-in NDA template-v1 rendered to
// HTML for editor seed (NDA-specific; non-NDA types should seed from a templateId).
staffRoute.get(
  '/:leadId/agreements/default-html',
  zValidator('param', leadIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const data = await getDefaultHtmlForEntity({
      entityType: 'lead',
      entityId: leadId,
      orgId,
    })
    return c.json({ success: true, data })
  },
)

// POST /:leadId/agreements/preview-pdf — in-memory render of the (possibly-
// edited) agreement body. Streams `application/pdf` bytes; no DB write.
staffRoute.post(
  '/:leadId/agreements/preview-pdf',
  zValidator('param', leadIdParamSchema),
  zValidator('json', previewAgreementBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const body = c.req.valid('json')
    const buf = await renderPreviewPdf({
      entityType: 'lead',
      entityId: leadId,
      orgId,
      contentHtml: body.contentHtml,
      title: body.title,
    })
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="agreement-preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  },
)

// GET /:leadId/agreements — list agreements for a lead (optional ?type filter)
staffRoute.get(
  '/:leadId/agreements',
  zValidator('param', leadIdParamSchema),
  zValidator('query', listQuerySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId } = c.req.valid('param')
    const { type } = c.req.valid('query')
    const data = await listAgreementsForEntity({
      entityType: 'lead',
      entityId: leadId,
      orgId,
      type,
    })
    return c.json({ success: true, data })
  },
)

// PATCH /:leadId/agreements/:id/deposit — update deposit state + note
staffRoute.patch(
  '/:leadId/agreements/:id/deposit',
  zValidator('param', leadAndAgreementIdParamSchema),
  zValidator('json', updateDepositBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updated = await updateDepositForEntity({
      entityType: 'lead',
      entityId: leadId,
      agreementId: id,
      orgId,
      status: body.depositStatus,
      note: body.depositNote ?? null,
      paidAt: body.depositPaidAt ? new Date(body.depositPaidAt) : null,
    })
    return c.json({ success: true, data: updated })
  },
)

// GET /:leadId/agreements/:id/pdf — presigned R2 URL (15-min TTL)
staffRoute.get(
  '/:leadId/agreements/:id/pdf',
  zValidator('param', leadAndAgreementIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const url = await getPresignedPdfUrlForEntity({
      entityType: 'lead',
      entityId: leadId,
      agreementId: id,
      orgId,
    })
    return c.json({ success: true, url })
  },
)

// POST /:leadId/agreements/:id/resend — reuse token if active, rotate if expired
staffRoute.post(
  '/:leadId/agreements/:id/resend',
  zValidator('param', leadAndAgreementIdParamSchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { leadId, id } = c.req.valid('param')
    const result = await resendAgreementForEntity({
      entityType: 'lead',
      entityId: leadId,
      agreementId: id,
      orgId,
      staffId,
    })
    return c.json({
      success: true,
      data: result.agreement,
      url: result.url,
      rotated: result.rotated,
    })
  },
)

export { staffRoute }
