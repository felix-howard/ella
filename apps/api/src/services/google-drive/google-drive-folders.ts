import type { drive_v3 } from 'googleapis'
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from './google-drive-config'
import type { GoogleDriveClient } from './google-drive-client'
import { GoogleDriveServiceError, normalizeGoogleDriveError } from './google-drive-errors'

const FOLDER_FIELDS = 'id,name,mimeType,webViewLink,capabilities/canAddChildren,appProperties'
const LIST_FOLDER_FIELDS = 'files(id,name,mimeType,webViewLink,appProperties)'

export interface GoogleDriveFolderView {
  id: string
  name: string | null
  webViewLink: string | null
}

export type GoogleDriveFolderAppProperties = {
  ellaOrgId: string
  ellaOwnerClientId: string
  ellaClientGroupId?: string | null
  ellaBusinessClientId?: string | null
  ellaFolderRole: string
}

function asFolderView(file: drive_v3.Schema$File): GoogleDriveFolderView {
  if (!file.id) {
    throw new GoogleDriveServiceError('DRIVE_ROOT_INVALID')
  }

  return {
    id: file.id,
    name: file.name ?? null,
    webViewLink: file.webViewLink ?? buildGoogleDriveFolderWebUrl(file.id),
  }
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function appPropertyQuery(key: string, value: string): string {
  return `appProperties has { key='${escapeDriveQueryLiteral(key)}' and value='${escapeDriveQueryLiteral(value)}' }`
}

function buildAppPropertiesQuery(properties: GoogleDriveFolderAppProperties): string[] {
  const entries = Object.entries(toDriveAppProperties(properties))

  return entries.map(([key, value]) => appPropertyQuery(key, value))
}

function toDriveAppProperties(properties: GoogleDriveFolderAppProperties): Record<string, string> {
  const required = {
    ellaOrgId: properties.ellaOrgId,
    ellaOwnerClientId: properties.ellaOwnerClientId,
    ellaFolderRole: properties.ellaFolderRole,
  }

  for (const value of Object.values(required)) {
    if (value.trim() === '') {
      throw new GoogleDriveServiceError('DRIVE_ROOT_INVALID')
    }
  }

  return {
    ...required,
    ...(properties.ellaClientGroupId && properties.ellaClientGroupId.trim() !== ''
      ? { ellaClientGroupId: properties.ellaClientGroupId }
      : {}),
    ...(properties.ellaBusinessClientId && properties.ellaBusinessClientId.trim() !== ''
      ? { ellaBusinessClientId: properties.ellaBusinessClientId }
      : {}),
  }
}

export function buildGoogleDriveFolderWebUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`
}

export async function getGoogleDriveFolder(
  drive: GoogleDriveClient,
  folderId: string
): Promise<drive_v3.Schema$File> {
  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: FOLDER_FIELDS,
      supportsAllDrives: true,
    })
    return response.data
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_ROOT_INVALID')
  }
}

export async function testGoogleDriveRootFolderAccess(
  drive: GoogleDriveClient,
  rootFolderId: string
): Promise<GoogleDriveFolderView> {
  const folder = await getGoogleDriveFolder(drive, rootFolderId)

  if (
    folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE ||
    folder.capabilities?.canAddChildren !== true
  ) {
    throw new GoogleDriveServiceError('DRIVE_ROOT_INVALID')
  }

  return asFolderView(folder)
}

export async function createGoogleDriveFolder(
  drive: GoogleDriveClient,
  input: {
    parentFolderId: string
    name: string
    appProperties: GoogleDriveFolderAppProperties
  }
): Promise<GoogleDriveFolderView> {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: input.name,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        parents: [input.parentFolderId],
        appProperties: toDriveAppProperties(input.appProperties),
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    })

    return asFolderView(response.data)
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_ROOT_INVALID')
  }
}

export async function updateGoogleDriveFolder(
  drive: GoogleDriveClient,
  input: {
    folderId: string
    name?: string
    appProperties?: GoogleDriveFolderAppProperties
  }
): Promise<GoogleDriveFolderView> {
  try {
    const response = await drive.files.update({
      fileId: input.folderId,
      requestBody: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.appProperties ? { appProperties: toDriveAppProperties(input.appProperties) } : {}),
      },
      fields: FOLDER_FIELDS,
      supportsAllDrives: true,
    })

    return asFolderView(response.data)
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_ROOT_INVALID')
  }
}

export async function findGoogleDriveFolderByAppProperties(
  drive: GoogleDriveClient,
  input: {
    parentFolderId: string
    appProperties: GoogleDriveFolderAppProperties
  }
): Promise<GoogleDriveFolderView | null> {
  const query = [
    `'${escapeDriveQueryLiteral(input.parentFolderId)}' in parents`,
    `mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
    'trashed = false',
    ...buildAppPropertiesQuery(input.appProperties),
  ].join(' and ')

  try {
    const response = await drive.files.list({
      q: query,
      fields: LIST_FOLDER_FIELDS,
      spaces: 'drive',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })

    const [folder] = response.data.files ?? []
    return folder ? asFolderView(folder) : null
  } catch (error) {
    throw normalizeGoogleDriveError(error, 'DRIVE_ROOT_INVALID')
  }
}
