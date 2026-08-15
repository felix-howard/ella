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

export interface GoogleDrivePermissionDeleteInput {
  folderId: string
  permissionId: string
}

export interface GoogleDrivePermissionDeleteResult {
  folderId: string
  email: string
  role: GoogleDrivePermissionRole
  type: GoogleDrivePermissionType
  permissionId: string
}

export interface GoogleDrivePermissionReconcileInput {
  desiredGrants: GoogleDrivePermissionGrant[]
  previouslyAppliedKeys?: string[]
  deleteStale?: boolean
  onAppliedPermissionKeysChange?: (appliedPermissionKeys: string[]) => Promise<void>
}

export interface GoogleDrivePermissionReconcileResult {
  granted: GoogleDrivePermissionResult[]
  deleted: GoogleDrivePermissionDeleteResult[]
  appliedPermissionKeys: string[]
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

export function getGoogleDrivePermissionGrantKey(grant: GoogleDrivePermissionGrant): string {
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
    const key = getGoogleDrivePermissionGrantKey(grant)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(await createPermission(drive, grant))
  }

  return results
}

export async function listGoogleDrivePermissions(
  drive: GoogleDriveClient,
  folderId: string
): Promise<GoogleDrivePermissionSchema[]> {
  if (!folderId || folderId.trim() === '') {
    throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED')
  }

  try {
    const permissions: GoogleDrivePermissionSchema[] = []
    let pageToken: string | undefined

    do {
      const response = await drive.permissions.list({
        fileId: folderId,
        fields: 'nextPageToken,permissions(id,type,role,emailAddress,deleted)',
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
      })

      permissions.push(...(response.data.permissions ?? []))
      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)

    return permissions
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_PERMISSION_FAILED')
  }
}

export async function deleteGoogleDrivePermission(
  drive: GoogleDriveClient,
  input: GoogleDrivePermissionDeleteInput
): Promise<void> {
  if (!input.folderId || input.folderId.trim() === '' || !input.permissionId || input.permissionId.trim() === '') {
    throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED')
  }

  try {
    await drive.permissions.delete({
      fileId: input.folderId,
      permissionId: input.permissionId,
      supportsAllDrives: true,
    })
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_PERMISSION_FAILED')
  }
}

function parseAppliedPermissionKey(key: string): GoogleDrivePermissionGrant | null {
  const [folderId, type, email, role, ...extra] = key.split(':')
  if (
    extra.length > 0 ||
    !folderId ||
    !EMAIL_PATTERN.test(email ?? '') ||
    (type !== 'user' && type !== 'group') ||
    (role !== 'reader' && role !== 'writer')
  ) {
    return null
  }

  return { folderId, type, email, role }
}

function isMatchingPermission(
  permission: GoogleDrivePermissionSchema,
  grant: GoogleDrivePermissionGrant
): permission is GoogleDrivePermissionSchema & { id: string } {
  return Boolean(permission.id) &&
    permission.deleted !== true &&
    permission.type === grant.type &&
    permission.role === grant.role &&
    normalizeEmail(permission.emailAddress ?? '') === normalizeEmail(grant.email)
}

async function reportAppliedPermissionKeys(
  keys: Set<string>,
  onAppliedPermissionKeysChange?: (appliedPermissionKeys: string[]) => Promise<void>
): Promise<void> {
  if (onAppliedPermissionKeysChange) {
    await onAppliedPermissionKeysChange(Array.from(keys))
  }
}

export async function reconcileGoogleDriveFolderPermissionsSequentially(
  drive: GoogleDriveClient,
  input: GoogleDrivePermissionReconcileInput
): Promise<GoogleDrivePermissionReconcileResult> {
  const desiredGrants = new Map<string, GoogleDrivePermissionGrant>()
  for (const grant of input.desiredGrants) {
    desiredGrants.set(getGoogleDrivePermissionGrantKey(grant), grant)
  }

  const appliedPermissionKeys = new Set(input.previouslyAppliedKeys ?? [])
  const granted: GoogleDrivePermissionResult[] = []
  const deleted: GoogleDrivePermissionDeleteResult[] = []

  for (const [key, grant] of desiredGrants) {
    if (appliedPermissionKeys.has(key)) continue
    granted.push(await createPermission(drive, grant))
    appliedPermissionKeys.add(key)
    await reportAppliedPermissionKeys(appliedPermissionKeys, input.onAppliedPermissionKeysChange)
  }

  if (input.deleteStale === false) {
    return {
      granted,
      deleted,
      appliedPermissionKeys: Array.from(appliedPermissionKeys),
    }
  }

  const staleGrantsByFolder = new Map<string, GoogleDrivePermissionGrant[]>()
  for (const key of appliedPermissionKeys) {
    if (desiredGrants.has(key)) continue
    const staleGrant = parseAppliedPermissionKey(key)
    if (!staleGrant) continue
    const folderGrants = staleGrantsByFolder.get(staleGrant.folderId) ?? []
    folderGrants.push(staleGrant)
    staleGrantsByFolder.set(staleGrant.folderId, folderGrants)
  }

  for (const [folderId, staleGrants] of staleGrantsByFolder) {
    const currentPermissions = await listGoogleDrivePermissions(drive, folderId)
    for (const staleGrant of staleGrants) {
      const staleKey = getGoogleDrivePermissionGrantKey(staleGrant)
      const permission = currentPermissions.find((candidate) =>
        isMatchingPermission(candidate, staleGrant)
      )
      appliedPermissionKeys.delete(staleKey)
      if (!permission) {
        await reportAppliedPermissionKeys(appliedPermissionKeys, input.onAppliedPermissionKeysChange)
        continue
      }

      await deleteGoogleDrivePermission(drive, {
        folderId,
        permissionId: permission.id,
      })
      deleted.push({
        folderId,
        email: normalizeEmail(staleGrant.email),
        role: staleGrant.role,
        type: staleGrant.type,
        permissionId: permission.id,
      })
      await reportAppliedPermissionKeys(appliedPermissionKeys, input.onAppliedPermissionKeysChange)
    }
  }

  return {
    granted,
    deleted,
    appliedPermissionKeys: Array.from(appliedPermissionKeys),
  }
}

export type GoogleDrivePermissionSchema = drive_v3.Schema$Permission
