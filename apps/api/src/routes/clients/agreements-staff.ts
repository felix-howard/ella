/**
 * Staff-facing agreement handlers for the Client entity — mounted on
 * `/clients`, so paths are relative to `/clients/:clientId/agreements/...`.
 * Mirrors the Lead staff routes shape: identical method+path pattern,
 * identical response envelopes; the only differences are the param name and
 * the entityType passed to the entity-agnostic service layer.
 *
 * Auth: parent app already attaches `authMiddleware` for `/clients/*`
 * (`app.ts:82`); this sub-route layers `requireOrgAdmin` on top because
 * agreement mutations are legally sensitive (org-admin only).
 *
 * Read-only listing of agreements for a client lives in `./agreements.ts` and
 * uses a looser scope (any staff with client access), so it stays as-is and
 * we intentionally do NOT redefine `GET /:clientId/agreements` here.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createAgreementForEntity,
  getDefaultHtmlForEntity,
  updateDepositForEntity,
  getPresignedPdfUrlForEntity,
  resendAgreementForEntity,
  extendAgreementForEntity,
  renderPreviewPdf,
} from '../../services/agreements/agreement-service'
import {
  createAgreementBodySchema,
  previewAgreementBodySchema,
  updateDepositBodySchema,
  extendAgreementBodySchema,
} from '../agreements/schemas'
import {
  clientIdParamSchema,
  clientAndAgreementIdParamSchema,
} from './agreements-staff-schemas'

const clientsAgreementsStaffRoute = new Hono<{ Variables: AuthVariables }>()

clientsAgreementsStaffRoute.use('*', requireOrgAdmin)

const defaultHtmlQuerySchema = z.object({
  type: z.enum(['NDA', 'ENGAGEMENT_LETTER']).default('NDA'),
}).strict()

function getAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// POST /:clientId/agreements — create agreement, generate token, send SMS.
clientsAgreementsStaffRoute.post(
  '/:clientId/agreements',
  zValidator('param', clientIdParamSchema),
  zValidator('json', createAgreementBodySchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { agreement, url } = await createAgreementForEntity({
      entityType: 'client',
      entityId: clientId,
      orgId,
      staffId,
      type: body.type,
      title: body.title,
      contentHtml: body.contentHtml,
      templateId: body.templateId,
      depositAmount: body.depositAmount ?? null,
      internalNote: body.internalNote,
      expiryDays: body.expiryDays,
    })
    return c.json({ success: true, data: agreement, url }, 201)
  },
)

// GET /:clientId/agreements/default-html — built-in type-specific HTML for editor seed.
clientsAgreementsStaffRoute.get(
  '/:clientId/agreements/default-html',
  zValidator('param', clientIdParamSchema),
  zValidator('query', defaultHtmlQuerySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const { type } = c.req.valid('query')
    const data = await getDefaultHtmlForEntity({
      entityType: 'client',
      entityId: clientId,
      orgId,
      type,
    })
    return c.json({ success: true, data })
  },
)

// POST /:clientId/agreements/preview-pdf — in-memory preview render. No DB write.
clientsAgreementsStaffRoute.post(
  '/:clientId/agreements/preview-pdf',
  zValidator('param', clientIdParamSchema),
  zValidator('json', previewAgreementBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const body = c.req.valid('json')
    const buf = await renderPreviewPdf({
      entityType: 'client',
      entityId: clientId,
      orgId,
      type: body.type,
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

// PATCH /:clientId/agreements/:id/deposit — update deposit state + note
clientsAgreementsStaffRoute.patch(
  '/:clientId/agreements/:id/deposit',
  zValidator('param', clientAndAgreementIdParamSchema),
  zValidator('json', updateDepositBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updated = await updateDepositForEntity({
      entityType: 'client',
      entityId: clientId,
      agreementId: id,
      orgId,
      status: body.depositStatus,
      note: body.depositNote ?? null,
      paidAt: body.depositPaidAt ? new Date(body.depositPaidAt) : null,
    })
    return c.json({ success: true, data: updated })
  },
)

// GET /:clientId/agreements/:id/pdf — presigned R2 URL (15-min TTL)
clientsAgreementsStaffRoute.get(
  '/:clientId/agreements/:id/pdf',
  zValidator('param', clientAndAgreementIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const url = await getPresignedPdfUrlForEntity({
      entityType: 'client',
      entityId: clientId,
      agreementId: id,
      orgId,
    })
    return c.json({ success: true, url })
  },
)

// POST /:clientId/agreements/:id/resend — reuse token if active, rotate if expired
clientsAgreementsStaffRoute.post(
  '/:clientId/agreements/:id/resend',
  zValidator('param', clientAndAgreementIdParamSchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const result = await resendAgreementForEntity({
      entityType: 'client',
      entityId: clientId,
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

// POST /:clientId/agreements/:id/extend — push expiresAt forward without rotating
// the token or sending SMS.
clientsAgreementsStaffRoute.post(
  '/:clientId/agreements/:id/extend',
  zValidator('param', clientAndAgreementIdParamSchema),
  zValidator('json', extendAgreementBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const { days } = c.req.valid('json')
    const data = await extendAgreementForEntity({
      entityType: 'client',
      entityId: clientId,
      agreementId: id,
      orgId,
      days,
    })
    return c.json({ success: true, data })
  },
)

export { clientsAgreementsStaffRoute }
