import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClientDriveStructure,
  getClientDriveStructureOptions,
} from '../client-drive-structure-service'

const CLIENT_ID = 'caaaaaaaaaaaaaaaaaaaaaaaa'

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    firstName: 'Linh',
    lastName: 'Nguyen',
    name: 'Linh Nguyen',
    email: 'client@test.com',
    clientType: 'INDIVIDUAL',
    clientGroupId: null,
    businessState: null,
    managedBy: null,
    managers: [],
    clientGroup: null,
    ...overrides,
  }
}

function folderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'drive_folder_row',
    organizationId: 'org_1',
    ownerClientId: CLIENT_ID,
    clientGroupId: null,
    folderName: 'Linh Nguyen 1234 - TX - Multi',
    rootFolderId: 'root_folder',
    rootFolderWebUrl: 'https://drive.example/root',
    amWorkFolderId: 'am_work',
    amWorkFolderWebUrl: 'https://drive.example/am',
    corpAdminFolderId: 'corp',
    corpAdminFolderWebUrl: 'https://drive.example/corp',
    sharedFolderId: 'shared',
    sharedFolderWebUrl: 'https://drive.example/shared',
    status: 'READY',
    inputSnapshot: {},
    permissionSnapshot: {
      adminGroupEmail: null,
      adminEmails: [],
      accountManagerEmails: [],
      clientEmail: 'client@test.com',
    },
    lastErrorCode: null,
    lastErrorMessage: null,
    createdByStaffId: 'staff_1',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    ...overrides,
  }
}

function baseDb(overrides: Record<string, unknown> = {}) {
  return {
    client: { findFirst: vi.fn().mockResolvedValue(clientRow()) },
    staff: { findMany: vi.fn().mockResolvedValue([]) },
    googleDriveConnection: {
      findUnique: vi.fn().mockResolvedValue({
        status: 'CONNECTED',
        rootFolderId: 'firm_root',
        adminGroupEmail: null,
        refreshTokenEncrypted: 'encrypted',
      }),
    },
    clientDriveFolder: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    ...overrides,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('client Drive structure service', () => {
  it('defaults standalone business clients to a single-business folder option', async () => {
    const db = baseDb({
      client: {
        findFirst: vi.fn().mockResolvedValue(clientRow({
          clientType: 'BUSINESS',
          name: 'Acme LLC',
          firstName: '',
          lastName: null,
          businessState: 'TX',
        })),
      },
    })

    const options = await getClientDriveStructureOptions({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
    }, db)

    expect(options.defaultBusinessMode).toBe('SINGLE_BUSINESS')
    expect(options.defaultBusinessName).toBe('Acme LLC')
    expect(options.defaultState).toBe('TX')
  })

  it('returns existing READY folders without starting provider work', async () => {
    const existing = folderRow()
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    })

    const response = await createClientDriveStructure({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    }, db)

    expect(response.folder?.status).toBe('READY')
    expect(response.created).toBe(false)
    expect(response.permissionSummary).toEqual({
      adminGroupEmail: null,
      adminEmails: [],
      accountManagerEmails: [],
      clientEmail: 'client@test.com',
    })
    expect((db as { clientDriveFolder: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } }).clientDriveFolder.create).not.toHaveBeenCalled()
    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).not.toHaveBeenCalled()
  })

  it('rejects concurrent recent CREATING rows before external Drive creates', async () => {
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(folderRow({
          status: 'CREATING',
          updatedAt: new Date(),
          rootFolderId: null,
          amWorkFolderId: null,
          corpAdminFolderId: null,
          sharedFolderId: null,
        })),
        create: vi.fn(),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    })

    await expect(createClientDriveStructure({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    }, db)).rejects.toMatchObject({ code: 'DRIVE_STRUCTURE_IN_PROGRESS' })

    expect((db as { clientDriveFolder: { create: ReturnType<typeof vi.fn> } }).clientDriveFolder.create).not.toHaveBeenCalled()
  })

  it('rejects a lost atomic claim after unique insert conflict', async () => {
    const existing = folderRow({
      status: 'FAILED',
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      rootFolderId: null,
      amWorkFolderId: null,
      corpAdminFolderId: null,
      sharedFolderId: null,
    })
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    })

    await expect(createClientDriveStructure({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    }, db)).rejects.toMatchObject({ code: 'DRIVE_STRUCTURE_IN_PROGRESS' })

    expect((db as { clientDriveFolder: { updateMany: ReturnType<typeof vi.fn>; findUniqueOrThrow: ReturnType<typeof vi.fn> } }).clientDriveFolder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'drive_folder_row',
        status: 'FAILED',
        updatedAt: existing.updatedAt,
      },
      data: expect.objectContaining({
        status: 'CREATING',
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    })
    expect((db as { clientDriveFolder: { findUniqueOrThrow: ReturnType<typeof vi.fn> } }).clientDriveFolder.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('rejects client emails that are not on the org-scoped client or group', async () => {
    const db = baseDb()

    await expect(createClientDriveStructure({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'outsider@test.com',
        sendNotificationEmail: false,
      },
    }, db)).rejects.toMatchObject({
      code: 'DRIVE_PERMISSION_FAILED',
      message: 'Client email must match an org-scoped client email.',
    })
  })
})
