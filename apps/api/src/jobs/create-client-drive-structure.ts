import { ActivityRiskLevel } from '@ella/db'
import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { executeQueuedClientDriveStructureCreation } from '../services/google-drive/client-drive-structure-service'
import { logStaffActivity } from '../services/activity-log'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TARGET_TYPES,
} from '../services/activity-actions'

export const createClientDriveStructureJob = inngest.createFunction(
  {
    id: 'create-client-drive-structure',
    retries: 2,
    throttle: { limit: 5, period: '1m' },
  },
  { event: 'client/drive-structure.create' },
  async ({ event, step }) => {
    const result = await step.run('create-drive-structure', async () => {
      return executeQueuedClientDriveStructureCreation(event.data)
    })

    if ('skipped' in result || !result.folder || result.folder.status !== 'READY') {
      return result
    }

    if (event.data.actorStaffId) {
      await step.run('log-drive-structure-activity', async () => {
        const client = await prisma.client.findFirst({
          where: {
            id: event.data.clientId,
            organizationId: event.data.organizationId,
          },
          select: { id: true, name: true },
        })

        await logStaffActivity({
          organizationId: event.data.organizationId,
          clientId: event.data.clientId,
          actorStaffId: event.data.actorStaffId!,
          category: ACTIVITY_CATEGORIES.CLIENT,
          targetType: ACTIVITY_TARGET_TYPES.CLIENT,
          targetId: event.data.clientId,
          targetLabel: client?.name ?? result.folder?.folderName ?? null,
          summary: 'Created Google Drive folder structure',
          action: ACTIVITY_ACTIONS.CLIENT.DRIVE_STRUCTURE_CREATED,
          riskLevel: ActivityRiskLevel.MEDIUM,
          metadata: {
            status: result.folder?.status,
            ownerClientId: result.folder?.ownerClientId,
            clientGroupId: result.folder?.clientGroupId,
            permissionTargetCounts: {
              accountManagers: result.permissionSummary?.accountManagerEmails.length ?? 0,
              admins: result.permissionSummary?.adminEmails.length ?? 0,
              hasAdminGroup: Boolean(result.permissionSummary?.adminGroupEmail),
              hasClient: Boolean(result.permissionSummary?.clientEmail),
            },
          },
        })
      })
    }

    return result
  }
)
