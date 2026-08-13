import { describe, expect, it, vi } from 'vitest'
import { resolveClientDrivePermissionTargets } from '../client-drive-permission-targets'

function dbWithStaffRows(rows: unknown[]) {
  return {
    staff: {
      findMany: vi.fn()
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([
          { id: 'manager_1', name: 'Manager', email: 'Manager@Test.COM', driveEmails: [] },
        ]),
    },
  } as never
}

describe('resolveClientDrivePermissionTargets', () => {
  it('normalizes admin aliases, manager fallback, and client emails', async () => {
    const db = dbWithStaffRows([
      { id: 'admin_1', name: 'Admin', email: 'Admin@Test.COM', driveEmails: ['Drive@Test.COM', 'drive@test.com'] },
    ])

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: [],
      clientEmail: ' Client@Test.COM ',
    }, db)

    expect(result.admins).toEqual([
      { id: 'admin_1', name: 'Admin', email: 'drive@test.com' },
    ])
    expect(result.accountManagers).toEqual([
      { id: 'manager_1', name: 'Manager', email: 'manager@test.com' },
    ])
    expect(result.clientEmail).toBe('client@test.com')
  })

  it('rejects invalid staff Drive email aliases without partial targets', async () => {
    const db = dbWithStaffRows([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com', driveEmails: ['not-an-email'] },
    ])

    await expect(resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: [],
      clientEmail: 'client@test.com',
    }, db)).rejects.toMatchObject({ code: 'DRIVE_PERMISSION_FAILED' })
  })

  it('keeps configured admin group in addition to active admin email targets', async () => {
    const db = dbWithStaffRows([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com', driveEmails: [] },
    ])

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: [],
      clientEmail: 'client@test.com',
      adminGroupEmail: 'Admins@Test.COM',
    }, db)

    expect(result.adminGroupEmail).toBe('admins@test.com')
    expect(result.admins).toEqual([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com' },
    ])
    expect(vi.mocked((db as { staff: { findMany: ReturnType<typeof vi.fn> } }).staff.findMany)).toHaveBeenCalledTimes(2)
  })
})
