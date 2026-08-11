import { describe, expect, it, vi } from 'vitest'
import type { GoogleDriveClient } from '../google-drive-client'
import {
  grantGoogleDriveGroupPermission,
  grantGoogleDrivePermissionsSequentially,
  grantGoogleDriveUserPermission,
} from '../google-drive-permissions'

function mockDrive(create: ReturnType<typeof vi.fn>): GoogleDriveClient {
  return {
    permissions: {
      create,
    },
  } as unknown as GoogleDriveClient
}

describe('Google Drive permission helpers', () => {
  it('grants user writer permission without sending notification by default', async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: 'perm_1' } })

    await expect(
      grantGoogleDriveUserPermission(mockDrive(create), {
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
      grantGoogleDriveGroupPermission(mockDrive(create), {
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

    const results = await grantGoogleDrivePermissionsSequentially(mockDrive(create), [
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
      grantGoogleDriveUserPermission(mockDrive(create), {
        folderId: 'shared_1',
        email: 'client@example.com',
        role: 'writer',
      })
    ).rejects.toMatchObject({ code: 'DRIVE_RATE_LIMITED' })
  })

  it('rejects invalid email without calling Google', async () => {
    const create = vi.fn()

    await expect(
      grantGoogleDriveUserPermission(mockDrive(create), {
        folderId: 'shared_1',
        email: 'not-email',
        role: 'writer',
      })
    ).rejects.toMatchObject({ code: 'DRIVE_PERMISSION_FAILED' })
    expect(create).not.toHaveBeenCalled()
  })
})
