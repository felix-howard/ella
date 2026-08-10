import type { GoogleDriveConnection, PrismaClient } from '@ella/db'
import { google, type drive_v3 } from 'googleapis'
import { prisma } from '../../lib/db'
import { decryptIntegrationSecret } from '../secrets/integration-secrets'
import { getGoogleDriveConfig, type GoogleDriveConfig } from './google-drive-config'
import { GoogleDriveServiceError } from './google-drive-errors'

export type GoogleDriveClient = drive_v3.Drive
export type GoogleDriveOAuthClient = InstanceType<typeof google.auth.OAuth2>

export function createGoogleDriveOAuthClient(
  driveConfig: GoogleDriveConfig = getGoogleDriveConfig()
): GoogleDriveOAuthClient {
  return new google.auth.OAuth2(
    driveConfig.clientId,
    driveConfig.clientSecret,
    driveConfig.redirectUri
  )
}

export function createGoogleDriveClientFromRefreshToken(
  refreshToken: string,
  driveConfig: GoogleDriveConfig = getGoogleDriveConfig()
): GoogleDriveClient {
  if (!refreshToken || refreshToken.trim() === '') {
    throw new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED')
  }

  const auth = createGoogleDriveOAuthClient(driveConfig)
  auth.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth })
}

export function createGoogleDriveClientForConnection(
  connection: Pick<GoogleDriveConnection, 'status' | 'refreshTokenEncrypted'>
): GoogleDriveClient {
  if (connection.status !== 'CONNECTED') {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  return createGoogleDriveClientFromRefreshToken(
    decryptIntegrationSecret(connection.refreshTokenEncrypted)
  )
}

export async function createGoogleDriveClientForOrganization(
  organizationId: string,
  db: PrismaClient = prisma
): Promise<GoogleDriveClient> {
  const connection = await db.googleDriveConnection.findUnique({
    where: { organizationId },
  })

  if (!connection || connection.status !== 'CONNECTED') {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  return createGoogleDriveClientForConnection(connection)
}
