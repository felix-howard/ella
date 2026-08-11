import { describe, expect, it, vi } from 'vitest'
import type { GoogleDriveClient } from '../google-drive-client'
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from '../google-drive-config'
import type { GoogleDriveServiceError } from '../google-drive-errors'
import {
  buildGoogleDriveFolderWebUrl,
  createGoogleDriveFolder,
  findGoogleDriveFolderByAppProperties,
  testGoogleDriveRootFolderAccess,
} from '../google-drive-folders'

function mockDrive(files: Partial<GoogleDriveClient['files']>): GoogleDriveClient {
  return { files } as GoogleDriveClient
}

describe('Google Drive folder helpers', () => {
  it('accepts an existing folder only when the caller can add children', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'root_1',
        name: 'Firm Root',
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        webViewLink: 'https://drive.example/root',
        capabilities: { canAddChildren: true },
      },
    })

    await expect(testGoogleDriveRootFolderAccess(mockDrive({ get }), 'root_1')).resolves.toEqual({
      id: 'root_1',
      name: 'Firm Root',
      webViewLink: 'https://drive.example/root',
    })
    expect(get).toHaveBeenCalledWith({
      fileId: 'root_1',
      fields: 'id,name,mimeType,webViewLink,capabilities/canAddChildren,appProperties',
      supportsAllDrives: true,
    })
  })

  it.each([
    ['text/plain', true],
    [GOOGLE_DRIVE_FOLDER_MIME_TYPE, false],
  ])('rejects invalid root folder access: mime=%s canAdd=%s', async (mimeType, canAddChildren) => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'root_1',
        mimeType,
        capabilities: { canAddChildren },
      },
    })

    await expect(testGoogleDriveRootFolderAccess(mockDrive({ get }), 'root_1')).rejects.toMatchObject({
      code: 'DRIVE_ROOT_INVALID',
    } satisfies Partial<GoogleDriveServiceError>)
  })

  it('creates folders with Drive folder MIME type, parent ID, appProperties, and limited fields', async () => {
    const create = vi.fn().mockResolvedValue({
      data: {
        id: 'folder_1',
        name: 'AM WORK',
      },
    })

    await expect(
      createGoogleDriveFolder(mockDrive({ create }), {
        parentFolderId: 'root_1',
        name: 'AM WORK',
        appProperties: {
          ellaOrgId: 'org_1',
          ellaOwnerClientId: 'client_1',
          ellaClientGroupId: null,
          ellaFolderRole: 'AM_WORK',
        },
      })
    ).resolves.toEqual({
      id: 'folder_1',
      name: 'AM WORK',
      webViewLink: buildGoogleDriveFolderWebUrl('folder_1'),
    })

    expect(create).toHaveBeenCalledWith({
      requestBody: {
        name: 'AM WORK',
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        parents: ['root_1'],
        appProperties: {
          ellaOrgId: 'org_1',
          ellaOwnerClientId: 'client_1',
          ellaFolderRole: 'AM_WORK',
        },
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    })
  })

  it('finds folders by parent and Ella appProperties', async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        files: [
          {
            id: 'folder_1',
            name: 'Client Root',
            webViewLink: 'https://drive.example/folder',
          },
        ],
      },
    })

    await expect(
      findGoogleDriveFolderByAppProperties(mockDrive({ list }), {
        parentFolderId: "root'1",
        appProperties: {
          ellaOrgId: 'org_1',
          ellaOwnerClientId: 'client_1',
          ellaFolderRole: 'CLIENT_ROOT',
        },
      })
    ).resolves.toEqual({
      id: 'folder_1',
      name: 'Client Root',
      webViewLink: 'https://drive.example/folder',
    })

    const call = list.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      fields: 'files(id,name,mimeType,webViewLink,appProperties)',
      spaces: 'drive',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })
    expect(call?.q).toContain("'root\\'1' in parents")
    expect(call?.q).toContain("appProperties has { key='ellaOrgId' and value='org_1' }")
    expect(call?.q).toContain("appProperties has { key='ellaFolderRole' and value='CLIENT_ROOT' }")
  })

  it('rejects blank required appProperties before creating or searching', async () => {
    const create = vi.fn()
    const list = vi.fn()
    const appProperties = {
      ellaOrgId: '',
      ellaOwnerClientId: 'client_1',
      ellaFolderRole: 'AM_WORK',
    }

    await expect(
      createGoogleDriveFolder(mockDrive({ create }), {
        parentFolderId: 'root_1',
        name: 'AM WORK',
        appProperties,
      })
    ).rejects.toMatchObject({ code: 'DRIVE_ROOT_INVALID' })
    await expect(
      findGoogleDriveFolderByAppProperties(mockDrive({ list }), {
        parentFolderId: 'root_1',
        appProperties,
      })
    ).rejects.toMatchObject({ code: 'DRIVE_ROOT_INVALID' })
    expect(create).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  })
})
