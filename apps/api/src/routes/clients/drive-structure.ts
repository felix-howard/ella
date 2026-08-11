import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ActivityRiskLevel } from '@ella/db'
import { prisma } from '../../lib/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import { requireAdminOrManager, type AuthVariables } from '../../middleware/auth'
import { getAuditRequestContext, logStaffActivity } from '../../services/activity-log'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TARGET_TYPES,
} from '../../services/activity-actions'
import {
  createClientDriveStructure,
  getClientDriveStructureOptions,
  getClientDriveStructureStatus,
} from '../../services/google-drive/client-drive-structure-service'
import { GoogleDriveServiceError } from '../../services/google-drive/google-drive-errors'
import { clientIdParamSchema } from './schemas'

export const clientsDriveStructureRoute = new Hono<{ Variables: AuthVariables }>()

const createDriveStructureSchema = z.object({
  ssnLast4: z.string().trim().regex(/^\d{4}$/),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/),
  businessMode: z.enum(['MULTI', 'SINGLE_BUSINESS']),
  businessName: z.string().trim().min(1).max(160).optional(),
  accountManagerStaffIds: z.array(z.string().min(1)).max(50).default([]),
  clientEmail: z.string().trim().email(),
  sendNotificationEmail: z.boolean().default(false),
}).refine(
  (value) => value.businessMode === 'MULTI' || Boolean(value.businessName),
  { message: 'businessName is required for SINGLE_BUSINESS', path: ['businessName'] }
)

function driveErrorResponse(error: unknown) {
  if (error instanceof GoogleDriveServiceError) {
    if (error.message === 'Client not found.') {
      return { body: { error: 'NOT_FOUND', message: 'Client not found' }, status: 404 as const }
    }
    const status = error.code === 'DRIVE_PERMISSION_FAILED' || error.code === 'DRIVE_ROOT_INVALID'
      ? 400
      : 409
    return { body: { error: error.code, message: error.message }, status: status as 400 | 409 }
  }
  throw error
}

async function verifyClientForUser(user: AuthVariables['user'], clientId: string) {
  return prisma.client.findFirst({
    where: {
      id: clientId,
      ...buildClientScopeFilter(user),
    },
    select: { id: true, name: true },
  })
}

clientsDriveStructureRoute.get(
  '/:id/drive-structure',
  requireAdminOrManager,
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const client = await verifyClientForUser(user, id)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    try {
      return c.json(await getClientDriveStructureStatus({
        organizationId: user.organizationId,
        clientId: id,
      }))
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)

clientsDriveStructureRoute.get(
  '/:id/drive-structure/options',
  requireAdminOrManager,
  zValidator('param', clientIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const client = await verifyClientForUser(user, id)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    try {
      return c.json(await getClientDriveStructureOptions({
        organizationId: user.organizationId,
        clientId: id,
      }))
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)

clientsDriveStructureRoute.post(
  '/:id/drive-structure',
  requireAdminOrManager,
  zValidator('param', clientIdParamSchema),
  zValidator('json', createDriveStructureSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const payload = c.req.valid('json')
    const user = c.get('user')
    const client = await verifyClientForUser(user, id)
    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    try {
      const response = await createClientDriveStructure({
        organizationId: user.organizationId,
        clientId: id,
        actorStaffId: user.staffId,
        payload,
      })

      if (user.staffId && response.folder && response.created) {
        await logStaffActivity({
          organizationId: user.organizationId,
          clientId: id,
          actorStaffId: user.staffId,
          category: ACTIVITY_CATEGORIES.CLIENT,
          targetType: ACTIVITY_TARGET_TYPES.CLIENT,
          targetId: id,
          targetLabel: client.name,
          summary: 'Created Google Drive folder structure',
          action: ACTIVITY_ACTIONS.CLIENT.DRIVE_STRUCTURE_CREATED,
          riskLevel: ActivityRiskLevel.MEDIUM,
          metadata: {
            status: response.folder.status,
            ownerClientId: response.folder.ownerClientId,
            clientGroupId: response.folder.clientGroupId,
            permissionTargetCounts: {
              accountManagers: response.permissionSummary?.accountManagerEmails.length ?? 0,
              admins: response.permissionSummary?.adminEmails.length ?? 0,
              hasAdminGroup: Boolean(response.permissionSummary?.adminGroupEmail),
              hasClient: Boolean(response.permissionSummary?.clientEmail),
            },
          },
          request: getAuditRequestContext(c),
        })
      }

      return c.json(response, response.created ? 201 : 200)
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)
