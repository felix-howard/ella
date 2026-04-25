/**
 * Client-scoped NDA listing — read-only for the client overview tab.
 * Mounted under `/clients`, so paths are relative to `/clients/:clientId/nda`.
 * Auth is handled by the parent app middleware (`/clients/*` → authMiddleware);
 * scoping mirrors `GET /clients/:id` so any staff who can view the client can
 * view its NDA history (via `buildClientScopeFilter`).
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { buildNdaUrl } from '../../services/nda/nda-service'

const clientsNdaRoute = new Hono<{ Variables: AuthVariables }>()

const paramSchema = z.object({
  clientId: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid client ID format'),
})

// GET /clients/:clientId/nda — list NDAs linked to this client (org-scoped, read-only)
clientsNdaRoute.get(
  '/:clientId/nda',
  zValidator('param', paramSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.valid('param')

    // Verify caller can access this client (org + assignment scope) before exposing NDAs
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true, organizationId: true },
    })
    if (!client || !client.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const ndas = await prisma.ndaAgreement.findMany({
      where: { clientId, organizationId: client.organizationId },
      orderBy: { updatedAt: 'desc' },
    })

    // Mirror lead-scoped listing shape: include computed url for each NDA
    const data = ndas.map((nda) => ({ ...nda, url: buildNdaUrl(nda.token) }))
    return c.json({ success: true, data })
  },
)

export { clientsNdaRoute }
