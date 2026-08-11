import { config } from '../../lib/config'
import { GoogleDriveServiceError } from './google-drive-errors'

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
export const DEFAULT_GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'] as const

export interface GoogleDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  const driveConfig = config.googleDrive

  if (
    !driveConfig.isConfigured ||
    !driveConfig.hasTokenEncryptionKey ||
    !/^[0-9a-fA-F]{64}$/.test(driveConfig.tokenEncryptionKey)
  ) {
    throw new GoogleDriveServiceError('DRIVE_NOT_CONNECTED')
  }

  return {
    clientId: driveConfig.clientId,
    clientSecret: driveConfig.clientSecret,
    redirectUri: driveConfig.redirectUri,
    scopes: driveConfig.scopes.length > 0 ? [...driveConfig.scopes] : [...DEFAULT_GOOGLE_DRIVE_SCOPES],
  }
}
