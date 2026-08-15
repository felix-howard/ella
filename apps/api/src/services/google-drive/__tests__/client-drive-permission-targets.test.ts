import { describe, expect, it, vi } from 'vitest'
import { resolveClientDrivePermissionTargets } from '../client-drive-permission-targets'

function dbWithStaff(adminRows: unknown[], managerRows: unknown[]) {
  return {
    staff: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { role?: string } }) =>
        Promise.resolve(where.role === 'ADMIN' ? adminRows : managerRows)
      ),
    },
  } as never
}

describe('resolveClientDrivePermissionTargets', () => {
  it('normalizes admin aliases, only the selected managers, and client emails', async () => {
    const db = dbWithStaff(
      [{ id: 'admin_1', name: 'Admin', email: 'Admin@Test.COM', driveEmails: ['Drive@Test.COM', 'drive@test.com'] }],
      [{ id: 'manager_1', name: 'Manager', email: 'Manager@Test.COM', driveEmails: [] }],
    )

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['manager_1'],
      clientEmail: ' Client@Test.COM ',
    }, db)

    expect(result.admins).toEqual([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com' },
      { id: 'admin_1', name: 'Admin', email: 'drive@test.com' },
    ])
    expect(result.accountManagers).toEqual([
      { id: 'manager_1', name: 'Manager', email: 'manager@test.com' },
    ])
    expect(result.clientEmail).toBe('client@test.com')
  })

  it('collapses duplicate login and alias case variants', async () => {
    const db = dbWithStaff(
      [],
      [{
        id: 'manager_1',
        name: 'Manager',
        email: 'Manager@Test.COM',
        driveEmails: ['manager@test.com', 'MANAGER@Test.COM', 'Drive@Test.COM'],
      }],
    )

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['manager_1'],
      clientEmail: 'client@test.com',
    }, db)

    expect(result.accountManagers).toEqual([
      { id: 'manager_1', name: 'Manager', email: 'manager@test.com' },
      { id: 'manager_1', name: 'Manager', email: 'drive@test.com' },
    ])
  })

  it('grants no account managers when the client has none assigned', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'admin_1', name: 'Admin', email: 'admin@test.com', driveEmails: [] },
    ])
    const db = { staff: { findMany } } as never

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: [],
      clientEmail: 'client@test.com',
    }, db)

    expect(result.accountManagers).toEqual([])
    // Managers are never queried org-wide when the client has none assigned.
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: 'ADMIN' }),
    }))
  })

  it('scopes the manager query to the assigned staff ids', async () => {
    const findMany = vi.fn().mockImplementation(({ where }: { where: { role?: string } }) =>
      Promise.resolve(where.role === 'ADMIN'
        ? []
        : [{ id: 'manager_2', name: 'Manager Two', email: 'manager2@test.com', driveEmails: [] }])
    )
    const db = { staff: { findMany } } as never

    const result = await resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: ['manager_2'],
      clientEmail: 'client@test.com',
    }, db)

    expect(result.accountManagers).toEqual([
      { id: 'manager_2', name: 'Manager Two', email: 'manager2@test.com' },
    ])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['manager_2'] } }),
    }))
  })

  it('rejects invalid staff Drive email aliases without partial targets', async () => {
    const db = dbWithStaff(
      [{ id: 'admin_1', name: 'Admin', email: 'admin@test.com', driveEmails: ['not-an-email'] }],
      [],
    )

    await expect(resolveClientDrivePermissionTargets({
      organizationId: 'org_1',
      accountManagerStaffIds: [],
      clientEmail: 'client@test.com',
    }, db)).rejects.toMatchObject({ code: 'DRIVE_PERMISSION_FAILED' })
  })

  it('keeps configured admin group in addition to active admin email targets', async () => {
    const db = dbWithStaff(
      [{ id: 'admin_1', name: 'Admin', email: 'admin@test.com', driveEmails: [] }],
      [],
    )

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
  })
})
