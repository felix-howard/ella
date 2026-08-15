import { describe, expect, it, vi } from 'vitest'
import type { GoogleDriveClient } from '../google-drive-client'
import {
  deleteGoogleDrivePermission,
  grantGoogleDriveGroupPermission,
  grantGoogleDrivePermissionsSequentially,
  grantGoogleDriveUserPermission,
  listGoogleDrivePermissions,
  reconcileGoogleDriveFolderPermissionsSequentially,
} from '../google-drive-permissions'

function mockDrive(input: {
  create?: ReturnType<typeof vi.fn>
  list?: ReturnType<typeof vi.fn>
  delete?: ReturnType<typeof vi.fn>
}): GoogleDriveClient {
  return {
    permissions: {
      create: input.create ?? vi.fn(),
      list: input.list ?? vi.fn(),
      delete: input.delete ?? vi.fn(),
    },
  } as unknown as GoogleDriveClient
}

describe('Google Drive permission helpers', () => {
  it('grants user writer permission without sending notification by default', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'perm_1' } })

    await expect(
      grantGoogleDriveUserPermission(mockDrive({ create }), {
        folderId: 'shared_1',
        email: 'Client@Example.com',
        role: 'writer',
      })
    ).resolves.toEqual({
      folderId: 'shared_1',
      email: 'client@example.com',
      role: 'writer',
      type: 'user',
      permissionId: 'perm_1',
    })

    expect(create).toHaveBeenCalledWith({
      fileId: 'shared_1',
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: 'client@example.com',
      },
      fields: 'id',
      sendNotificationEmail: false,
      supportsAllDrives: true,
    })
  })

  it('grants group permission with caller-selected notification behavior', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'perm_group' } })

    await expect(
      grantGoogleDriveGroupPermission(mockDrive({ create }), {
        folderId: 'corp_1',
        email: 'admins@example.com',
        role: 'reader',
        sendNotificationEmail: true,
      })
    ).resolves.toMatchObject({
      email: 'admins@example.com',
      role: 'reader',
      type: 'group',
      permissionId: 'perm_group',
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ type: 'group', role: 'reader' }),
        sendNotificationEmail: true,
      })
    )
  })

  it('dedupes grants and writes permissions sequentially', async () => {
    const order: string[] = []
    const create = vi.fn(async (request: { requestBody: { emailAddress: string } }) => {
      order.push(`start:${request.requestBody.emailAddress}`)
      await Promise.resolve()
      order.push(`end:${request.requestBody.emailAddress}`)
      return { data: { id: `perm_${order.length}` } }
    })

    const results = await grantGoogleDrivePermissionsSequentially(mockDrive({ create }), [
      { folderId: 'am_1', email: 'am@example.com', role: 'writer', type: 'user' },
      { folderId: 'am_1', email: 'AM@example.com', role: 'writer', type: 'user' },
      { folderId: 'corp_1', email: 'admins@example.com', role: 'writer', type: 'group' },
    ])

    expect(results).toHaveLength(2)
    expect(create).toHaveBeenCalledTimes(2)
    expect(order).toEqual([
      'start:am@example.com',
      'end:am@example.com',
      'start:admins@example.com',
      'end:admins@example.com',
    ])
  })

  it('normalizes provider rate limits to a stable code', async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('quota exceeded'), { code: 429 }))

    await expect(
      grantGoogleDriveUserPermission(mockDrive({ create }), {
        folderId: 'shared_1',
        email: 'client@example.com',
        role: 'writer',
      })
    ).rejects.toMatchObject({ code: 'DRIVE_RATE_LIMITED' })
  })

  it('rejects invalid email without calling Google', async () => {
    const create = vi.fn()

    await expect(
      grantGoogleDriveUserPermission(mockDrive({ create }), {
        folderId: 'shared_1',
        email: 'not-email',
        role: 'writer',
      })
    ).rejects.toMatchObject({ code: 'DRIVE_PERMISSION_FAILED' })
    expect(create).not.toHaveBeenCalled()
  })

  it('lists permissions with a minimal field projection', async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        permissions: [
          {
            id: 'perm_1',
            type: 'user',
            role: 'writer',
            emailAddress: 'staff@test.com',
            deleted: false,
          },
        ],
      },
    })

    await expect(listGoogleDrivePermissions(mockDrive({ list }), 'folder_1')).resolves.toEqual([
      {
        id: 'perm_1',
        type: 'user',
        role: 'writer',
        emailAddress: 'staff@test.com',
        deleted: false,
      },
    ])

    expect(list).toHaveBeenCalledWith({
      fileId: 'folder_1',
      fields: 'nextPageToken,permissions(id,type,role,emailAddress,deleted)',
      pageSize: 100,
      pageToken: undefined,
      supportsAllDrives: true,
    })
  })

  it('deletes permissions by provider permission id', async () => {
    const deletePermission = vi.fn().mockResolvedValue({})

    await deleteGoogleDrivePermission(mockDrive({ delete: deletePermission }), {
      folderId: 'folder_1',
      permissionId: 'perm_1',
    })

    expect(deletePermission).toHaveBeenCalledWith({
      fileId: 'folder_1',
      permissionId: 'perm_1',
      supportsAllDrives: true,
    })
  })

  it('reconciles missing grants and stale direct permissions sequentially', async () => {
    const order: string[] = []
    const create = vi.fn(async (request: { requestBody: { emailAddress: string } }) => {
      order.push(`create:${request.requestBody.emailAddress}`)
      return { data: { id: `new_${request.requestBody.emailAddress}` } }
    })
    const list = vi.fn(async () => {
      order.push('list')
      return {
        data: {
          permissions: [
            {
              id: 'perm_old',
              type: 'user',
              role: 'writer',
              emailAddress: 'old@test.com',
              deleted: false,
            },
          ],
        },
      }
    })
    const deletePermission = vi.fn(async (request: { permissionId: string }) => {
      order.push(`delete:${request.permissionId}`)
      return {}
    })
    const snapshots: string[][] = []

    const result = await reconcileGoogleDriveFolderPermissionsSequentially(mockDrive({
      create,
      list,
      delete: deletePermission,
    }), {
      desiredGrants: [
        { folderId: 'folder_1', email: 'new@test.com', role: 'writer', type: 'user' },
        { folderId: 'folder_1', email: 'NEW@Test.com', role: 'writer', type: 'user' },
      ],
      previouslyAppliedKeys: [
        'folder_1:user:old@test.com:writer',
      ],
      onAppliedPermissionKeysChange: async (keys) => {
        snapshots.push(keys)
      },
    })

    expect(result.granted).toHaveLength(1)
    expect(result.deleted).toEqual([
      {
        folderId: 'folder_1',
        email: 'old@test.com',
        role: 'writer',
        type: 'user',
        permissionId: 'perm_old',
      },
    ])
    expect(result.appliedPermissionKeys).toEqual([
      'folder_1:user:new@test.com:writer',
    ])
    expect(order).toEqual([
      'create:new@test.com',
      'list',
      'delete:perm_old',
    ])
    expect(snapshots).toEqual([
      [
        'folder_1:user:old@test.com:writer',
        'folder_1:user:new@test.com:writer',
      ],
      [
        'folder_1:user:new@test.com:writer',
      ],
    ])
  })

  it('does not delete owner, deleted, mismatched, or missing stale permissions', async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        permissions: [
          {
            id: 'owner_perm',
            type: 'user',
            role: 'owner',
            emailAddress: 'owner@test.com',
            deleted: false,
          },
          {
            id: 'deleted_perm',
            type: 'user',
            role: 'writer',
            emailAddress: 'deleted@test.com',
            deleted: true,
          },
          {
            id: 'reader_perm',
            type: 'user',
            role: 'reader',
            emailAddress: 'writer@test.com',
            deleted: false,
          },
        ],
      },
    })
    const deletePermission = vi.fn()

    const result = await reconcileGoogleDriveFolderPermissionsSequentially(mockDrive({
      list,
      delete: deletePermission,
    }), {
      desiredGrants: [],
      previouslyAppliedKeys: [
        'folder_1:user:owner@test.com:writer',
        'folder_1:user:deleted@test.com:writer',
        'folder_1:user:writer@test.com:writer',
        'folder_1:user:missing@test.com:writer',
      ],
    })

    expect(deletePermission).not.toHaveBeenCalled()
    expect(result.deleted).toEqual([])
    expect(result.appliedPermissionKeys).toEqual([])
  })

  it('finds stale permissions after the first permissions.list page', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({
        data: {
          nextPageToken: 'page_2',
          permissions: [
            {
              id: 'unrelated',
              type: 'user',
              role: 'writer',
              emailAddress: 'unrelated@test.com',
              deleted: false,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          permissions: [
            {
              id: 'perm_old',
              type: 'user',
              role: 'writer',
              emailAddress: 'old@test.com',
              deleted: false,
            },
          ],
        },
      })
    const deletePermission = vi.fn().mockResolvedValue({})

    const result = await reconcileGoogleDriveFolderPermissionsSequentially(mockDrive({
      list,
      delete: deletePermission,
    }), {
      desiredGrants: [],
      previouslyAppliedKeys: ['folder_1:user:old@test.com:writer'],
    })

    expect(list).toHaveBeenNthCalledWith(1, {
      fileId: 'folder_1',
      fields: 'nextPageToken,permissions(id,type,role,emailAddress,deleted)',
      pageSize: 100,
      pageToken: undefined,
      supportsAllDrives: true,
    })
    expect(list).toHaveBeenNthCalledWith(2, {
      fileId: 'folder_1',
      fields: 'nextPageToken,permissions(id,type,role,emailAddress,deleted)',
      pageSize: 100,
      pageToken: 'page_2',
      supportsAllDrives: true,
    })
    expect(deletePermission).toHaveBeenCalledWith({
      fileId: 'folder_1',
      permissionId: 'perm_old',
      supportsAllDrives: true,
    })
    expect(result.deleted).toEqual([
      {
        folderId: 'folder_1',
        email: 'old@test.com',
        role: 'writer',
        type: 'user',
        permissionId: 'perm_old',
      },
    ])
    expect(result.appliedPermissionKeys).toEqual([])
  })
})
