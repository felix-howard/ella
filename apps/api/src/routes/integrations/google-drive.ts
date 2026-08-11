import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import { authMiddleware, requireAdminOrManager, requireOrgAdmin, type AuthVariables } from '../../middleware/auth'
import { isOrgAdmin } from '../../lib/org-scope'
import {
  buildGoogleDriveAuthUrl,
  exchangeGoogleDriveCodeForConnection,
  saveGoogleDriveConnection,
} from '../../services/google-drive/google-drive-oauth'
import { createGoogleDriveClientFromRefreshToken, createGoogleDriveClientForConnection } from '../../services/google-drive/google-drive-client'
import { GoogleDriveServiceError } from '../../services/google-drive/google-drive-errors'
import { testGoogleDriveRootFolderAccess } from '../../services/google-drive/google-drive-folders'

export const googleDriveIntegrationsRoute = new Hono<{ Variables: AuthVariables }>()

const oauthUrlSchema = z.object({
  rootFolderId: z.string().trim().min(1).optional(),
  adminGroupEmail: z.string().trim().email().nullable().optional(),
})

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

const settingsSchema = z.object({
  rootFolderId: z.string().trim().min(1),
  adminGroupEmail: z.string().trim().email().nullable().optional(),
})

function toConnectionDto(connection: NonNullable<Awaited<ReturnType<typeof prisma.googleDriveConnection.findUnique>>>) {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    rootFolderId: connection.rootFolderId,
    rootFolderName: connection.rootFolderName,
    rootFolderWebUrl: connection.rootFolderWebUrl,
    adminGroupEmail: connection.adminGroupEmail,
    googleAccountEmail: connection.googleAccountEmail,
    status: connection.status,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
    disconnectedAt: connection.disconnectedAt?.toISOString() ?? null,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}

function driveErrorResponse(error: unknown) {
  if (error instanceof GoogleDriveServiceError) {
    const status = error.code === 'DRIVE_ROOT_INVALID' ? 400 : 409
    return { body: { error: error.code, message: error.message }, status: status as 400 | 409 }
  }
  throw error
}

googleDriveIntegrationsRoute.get('/status', authMiddleware, requireAdminOrManager, async (c) => {
  const user = c.get('user')
  if (!user.organizationId) {
    return c.json({ error: 'ORG_REQUIRED', message: 'Organization required' }, 403)
  }

  const connection = await prisma.googleDriveConnection.findUnique({
    where: { organizationId: user.organizationId },
  })
  const isAdmin = isOrgAdmin(user)
  return c.json({
    isConfigured: config.googleDrive.isConfigured && config.googleDrive.hasTokenEncryptionKey,
    isAdmin,
    connected: connection?.status === 'CONNECTED',
    connection: isAdmin && connection ? toConnectionDto(connection) : null,
  })
})

googleDriveIntegrationsRoute.post(
  '/oauth-url',
  authMiddleware,
  requireOrgAdmin,
  zValidator('json', oauthUrlSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.organizationId || !user.staffId) {
      return c.json({ error: 'ORG_REQUIRED', message: 'Organization required' }, 403)
    }
    const payload = c.req.valid('json')

    try {
      return c.json({
        url: buildGoogleDriveAuthUrl({
          organizationId: user.organizationId,
          staffId: user.staffId,
          rootFolderId: payload.rootFolderId,
          adminGroupEmail: payload.adminGroupEmail ?? null,
        }),
      })
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)

googleDriveIntegrationsRoute.get(
  '/callback',
  zValidator('query', callbackQuerySchema),
  async (c) => {
    const { code, state } = c.req.valid('query')

    try {
      const exchanged = await exchangeGoogleDriveCodeForConnection({ code, state })
      const existing = await prisma.googleDriveConnection.findUnique({
        where: { organizationId: exchanged.organizationId },
      })
      const rootFolderId = exchanged.rootFolderId ?? existing?.rootFolderId
      if (!rootFolderId) {
        return c.json({ error: 'DRIVE_ROOT_REQUIRED', message: 'Google Drive root folder is required.' }, 400)
      }

      const drive = createGoogleDriveClientFromRefreshToken(exchanged.refreshToken)
      const rootFolder = await testGoogleDriveRootFolderAccess(drive, rootFolderId)
      const connection = await saveGoogleDriveConnection({
        organizationId: exchanged.organizationId,
        connectedByStaffId: exchanged.staffId,
        rootFolderId: rootFolder.id,
        rootFolderName: rootFolder.name,
        rootFolderWebUrl: rootFolder.webViewLink,
        adminGroupEmail: exchanged.adminGroupEmail ?? existing?.adminGroupEmail ?? null,
        googleAccountEmail: exchanged.googleAccountEmail,
        refreshToken: exchanged.refreshToken,
      })

      return c.json({ connection: toConnectionDto(connection) })
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)

googleDriveIntegrationsRoute.patch(
  '/settings',
  authMiddleware,
  requireOrgAdmin,
  zValidator('json', settingsSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.organizationId) {
      return c.json({ error: 'ORG_REQUIRED', message: 'Organization required' }, 403)
    }
    const payload = c.req.valid('json')

    try {
      const connection = await prisma.googleDriveConnection.findUnique({
        where: { organizationId: user.organizationId },
      })
      if (!connection) {
        throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
      }
      const drive = createGoogleDriveClientForConnection(connection)
      const rootFolder = await testGoogleDriveRootFolderAccess(drive, payload.rootFolderId)
      const updated = await prisma.googleDriveConnection.update({
        where: { organizationId: user.organizationId },
        data: {
          rootFolderId: rootFolder.id,
          rootFolderName: rootFolder.name,
          rootFolderWebUrl: rootFolder.webViewLink,
          adminGroupEmail: payload.adminGroupEmail ?? null,
          lastCheckedAt: new Date(),
          status: 'CONNECTED',
        },
      })

      return c.json({ connection: toConnectionDto(updated) })
    } catch (error) {
      const response = driveErrorResponse(error)
      return c.json(response.body, response.status)
    }
  }
)
