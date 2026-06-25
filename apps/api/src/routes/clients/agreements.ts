/**
 * Client-scoped agreement listing — read-only for the client overview tab.
 * Mounted under `/clients`, so paths are relative to `/clients/:clientId/agreements`.
 * Auth is handled by the parent app middleware (`/clients/*` → authMiddleware);
 * scoping mirrors `GET /clients/:id` so any staff who can view the client can
 * view its agreement history (via `buildClientScopeFilter`).
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { buildClientScopeFilter } from '../../lib/org-scope'
import {
  agreementResponseInclude,
  serializeAgreementResponse,
} from '../../services/agreements/agreement-response-serializer'
import { agreementTypeSchema } from '../agreements/schemas'

const clientsAgreementsRoute = new Hono<{ Variables: AuthVariables }>()

const paramSchema = z.object({
  clientId: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid client ID format'),
})

const querySchema = z.object({ type: agreementTypeSchema.optional() }).strict()

// GET /clients/:clientId/agreements — list agreements linked to this client
// (org-scoped, read-only). Optional `?type=` filter narrows by AgreementType.
clientsAgreementsRoute.get(
  '/:clientId/agreements',
  zValidator('param', paramSchema),
  zValidator('query', querySchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.valid('param')
    const { type } = c.req.valid('query')

    // Verify caller can access this client (org + assignment scope) before exposing data
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true, organizationId: true },
    })
    if (!client || !client.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        clientId,
        organizationId: client.organizationId,
        ...(type ? { type } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: agreementResponseInclude,
    })

    // Mirror lead-scoped listing shape while suppressing public URLs for drafts.
    const data = agreements.map(serializeAgreementResponse)
    return c.json({ success: true, data })
  },
)

export { clientsAgreementsRoute }
