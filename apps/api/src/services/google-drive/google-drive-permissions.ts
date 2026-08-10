import type { drive_v3 } from 'googleapis'
import type { GoogleDriveClient } from './google-drive-client'
import { GoogleDriveServiceError, normalizeGoogleDriveError } from './google-drive-errors'

export type GoogleDrivePermissionRole = 'reader' | 'writer'
export type GoogleDrivePermissionType = 'user' | 'group'

export interface GoogleDrivePermissionGrant {
  folderId: string
  email: string
  role: GoogleDrivePermissionRole
  type: GoogleDrivePermissionType
  sendNotificationEmail?: boolean
}

export interface GoogleDrivePermissionResult {
  folderId: string
  email: string
  role: GoogleDrivePermissionRole
  type: GoogleDrivePermissionType
  permissionId: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function assertValidPermissionInput(grant: GoogleDrivePermissionGrant): string {
  const email = normalizeEmail(grant.email)
  if (!grant.folderId || grant.folderId.trim() === '' || !EMAIL_PATTERN.test(email)) {
    throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED')
  }
  return email
}

function getGrantKey(grant: GoogleDrivePermissionGrant): string {
  return [grant.folderId, grant.type, normalizeEmail(grant.email), grant.role].join(':')
}

async function createPermission(
  drive: GoogleDriveClient,
  grant: GoogleDrivePermissionGrant
): Promise<GoogleDrivePermissionResult> {
  const email = assertValidPermissionInput(grant)

  try {
    const response = await drive.permissions.create({
      fileId: grant.folderId,
      requestBody: {
        type: grant.type,
        role: grant.role,
        emailAddress: email,
      },
      fields: 'id',
      sendNotificationEmail: grant.sendNotificationEmail ?? false,
      supportsAllDrives: true,
    })

    const permissionId = response.data.id
    if (!permissionId) {
      throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED')
    }

    return {
      folderId: grant.folderId,
      email,
      role: grant.role,
      type: grant.type,
      permissionId,
    }
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_PERMISSION_FAILED')
  }
}

export async function grantGoogleDriveUserPermission(
  drive: GoogleDriveClient,
  input: Omit<GoogleDrivePermissionGrant, 'type'>
): Promise<GoogleDrivePermissionResult> {
  return createPermission(drive, { ...input, type: 'user' })
}

export async function grantGoogleDriveGroupPermission(
  drive: GoogleDriveClient,
  input: Omit<GoogleDrivePermissionGrant, 'type'>
): Promise<GoogleDrivePermissionResult> {
  return createPermission(drive, { ...input, type: 'group' })
}

export async function grantGoogleDrivePermissionsSequentially(
  drive: GoogleDriveClient,
  grants: GoogleDrivePermissionGrant[]
): Promise<GoogleDrivePermissionResult[]> {
  const results: GoogleDrivePermissionResult[] = []
  const seen = new Set<string>()

  for (const grant of grants) {
    const key = getGrantKey(grant)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(await createPermission(drive, grant))
  }

  return results
}

export type GoogleDrivePermissionSchema = drive_v3.Schema$Permission
