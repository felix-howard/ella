import { describe, expect, it, vi } from 'vitest'
import { resolveClientDrivePermissionTargets } from '../client-drive-permission-targets'

function dbWithStaffRows(rows: unknown[]) {
  return {
    staff: {
      findMany: vi.fn()
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([
          { id: 'admin_1', name: 'Admin', email: 'Admin@Test.COM' },
        ]),
    },
  } as never
}

describe('resolveClientDrivePermissionTargets', () => {
  it('normalizes AM, admin fallback, and client emails', async () => {
    const db = dbWithStaffRows([
      { id: 'staff_1', name: 'Manager', email: 'Manager@Test.COM' },
    ])

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['staff_1'],
      clientEmail: ' Client@Test.COM ',
    }, db)

    expect(result.accountManagers).toEqual([
      { id: 'staff_1', name: 'Manager', email: 'manager@test.com' },
    ])
    expect(result.admins).toEqual([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com' },
    ])
    expect(result.clientEmail).toBe('client@test.com')
  })

  it('rejects inactive or cross-org AM staff IDs without partial targets', async () => {
    const db = dbWithStaffRows([])

    await expect(resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['staff_missing'],
      clientEmail: 'client@test.com',
    }, db)).rejects.toThrow('Invalid account manager target.')
  })

  it('uses configured admin group instead of admin email fallback', async () => {
    const db = dbWithStaffRows([
      { id: 'staff_1', name: 'Manager', email: 'manager@test.com' },
    ])

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['staff_1'],
      clientEmail: 'client@test.com',
      adminGroupEmail: 'Admins@Test.COM',
    }, db)

    expect(result.adminGroupEmail).toBe('admins@test.com')
    expect(result.admins).toEqual([])
    expect(vi.mocked((db as { staff: { findMany: ReturnType<typeof vi.fn> } }).staff.findMany)).toHaveBeenCalledTimes(1)
  })
})
