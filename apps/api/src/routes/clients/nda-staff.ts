/**
 * Staff-facing NDA handlers for the Client entity — mounted on `/clients`,
 * so paths are relative to `/clients/:clientId/nda/...`. Mirrors the Lead
 * staff routes shape: identical method+path pattern, identical response
 * envelopes; the only differences are the param name and the entityType
 * passed to the entity-agnostic service layer.
 *
 * Auth: parent app already attaches `authMiddleware` for `/clients/*`
 * (`app.ts:82`); this sub-route layers `requireOrgAdmin` on top because
 * NDA mutations are legally sensitive (org-admin only).
 *
 * Read-only listing of NDAs for a client lives in `./nda.ts` and uses a
 * looser scope (any staff with client access), so it stays as-is and we
 * intentionally do NOT redefine `GET /:clientId/nda` here.
 */
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { requireOrgAdmin } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  createNdaForEntity,
  getDefaultHtmlForEntity,
  updateDepositForEntity,
  getPresignedPdfUrlForEntity,
  resendNdaForEntity,
  renderPreviewPdf,
} from '../../services/nda/nda-service'
import {
  createNdaBodySchema,
  previewNdaBodySchema,
  updateDepositBodySchema,
} from '../nda/schemas'
import {
  clientIdParamSchema,
  clientAndNdaIdParamSchema,
} from './nda-staff-schemas'

const clientsNdaStaffRoute = new Hono<{ Variables: AuthVariables }>()

clientsNdaStaffRoute.use('*', requireOrgAdmin)

function getAuth(user: AuthUser): { orgId: string; staffId: string } {
  if (!user.organizationId) {
    throw new HTTPException(403, { message: 'Organization required' })
  }
  if (!user.staffId) {
    throw new HTTPException(403, { message: 'Staff record required' })
  }
  return { orgId: user.organizationId, staffId: user.staffId }
}

// POST /:clientId/nda — create NDA for a client, generate token, send SMS.
// Body is optional; pass `contentHtml` to snapshot a sanitized custom HTML.
clientsNdaStaffRoute.post(
  '/:clientId/nda',
  zValidator('param', clientIdParamSchema),
  zValidator('json', createNdaBodySchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const body = c.req.valid('json')
    const { nda, url } = await createNdaForEntity({
      entityType: 'client',
      entityId: clientId,
      orgId,
      staffId,
      contentHtml: body.contentHtml,
    })
    return c.json({ success: true, data: nda, url }, 201)
  },
)

// GET /:clientId/nda/default-html — template-v1 rendered to HTML for editor seed
clientsNdaStaffRoute.get(
  '/:clientId/nda/default-html',
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const data = await getDefaultHtmlForEntity({
      entityType: 'client',
      entityId: clientId,
      orgId,
    })
    return c.json({ success: true, data })
  },
)

// POST /:clientId/nda/preview-pdf — in-memory preview render. No DB write.
clientsNdaStaffRoute.post(
  '/:clientId/nda/preview-pdf',
  zValidator('param', clientIdParamSchema),
  zValidator('json', previewNdaBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId } = c.req.valid('param')
    const body = c.req.valid('json')
    const buf = await renderPreviewPdf({
      entityType: 'client',
      entityId: clientId,
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

// PATCH /:clientId/nda/:id/deposit — update deposit state + note
clientsNdaStaffRoute.patch(
  '/:clientId/nda/:id/deposit',
  zValidator('param', clientAndNdaIdParamSchema),
  zValidator('json', updateDepositBodySchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const body = c.req.valid('json')
    const updated = await updateDepositForEntity({
      entityType: 'client',
      entityId: clientId,
      ndaId: id,
      orgId,
      status: body.depositStatus,
      note: body.depositNote ?? null,
      paidAt: body.depositPaidAt ? new Date(body.depositPaidAt) : null,
    })
    return c.json({ success: true, data: updated })
  },
)

// GET /:clientId/nda/:id/pdf — presigned R2 URL (15-min TTL)
clientsNdaStaffRoute.get(
  '/:clientId/nda/:id/pdf',
  zValidator('param', clientAndNdaIdParamSchema),
  async (c) => {
    const { orgId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const url = await getPresignedPdfUrlForEntity({
      entityType: 'client',
      entityId: clientId,
      ndaId: id,
      orgId,
    })
    return c.json({ success: true, url })
  },
)

// POST /:clientId/nda/:id/resend — reuse token if active, rotate if expired
clientsNdaStaffRoute.post(
  '/:clientId/nda/:id/resend',
  zValidator('param', clientAndNdaIdParamSchema),
  async (c) => {
    const { orgId, staffId } = getAuth(c.get('user'))
    const { clientId, id } = c.req.valid('param')
    const result = await resendNdaForEntity({
      entityType: 'client',
      entityId: clientId,
      ndaId: id,
      orgId,
      staffId,
    })
    return c.json({
      success: true,
      data: result.nda,
      url: result.url,
      rotated: result.rotated,
    })
  },
)

export { clientsNdaStaffRoute }
