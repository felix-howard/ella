import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'
import { listClientPaidServices } from '../../services/payments/client-paid-services-service'
import { clientIdParamSchema } from './agreements-staff-schemas'

const clientsPaidServicesRoute = new Hono<{ Variables: AuthVariables }>()

clientsPaidServicesRoute.get(
  '/:clientId/paid-services',
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId } = c.req.valid('param')
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...buildClientScopeFilter(user) },
      select: { id: true, organizationId: true },
    })
    if (!client?.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    const result = await listClientPaidServices({
      clientId: client.id,
      organizationId: client.organizationId,
    })
    return c.json({ success: true, ...result })
  },
)

export { clientsPaidServicesRoute }
