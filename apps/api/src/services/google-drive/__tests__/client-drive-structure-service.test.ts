import { beforeEach, describe, expect, it, vi } from 'vitest'

const driveMocks = vi.hoisted(() => ({
  createGoogleDriveClientForConnection: vi.fn(),
  createGoogleDriveFolder: vi.fn(),
  findGoogleDriveFolderByAppProperties: vi.fn(),
  updateGoogleDriveFolder: vi.fn(),
  grantGoogleDrivePermissionsSequentially: vi.fn(),
}))

vi.mock('../google-drive-client', () => ({
  createGoogleDriveClientForConnection: driveMocks.createGoogleDriveClientForConnection,
}))

vi.mock('../google-drive-folders', () => ({
  createGoogleDriveFolder: driveMocks.createGoogleDriveFolder,
  findGoogleDriveFolderByAppProperties: driveMocks.findGoogleDriveFolderByAppProperties,
  updateGoogleDriveFolder: driveMocks.updateGoogleDriveFolder,
}))

vi.mock('../google-drive-permissions', () => ({
  grantGoogleDrivePermissionsSequentially: driveMocks.grantGoogleDrivePermissionsSequentially,
}))

import {
  createClientDriveStructure,
  executeQueuedClientDriveStructureCreation,
  getClientDriveStructureOptions,
  queueClientDriveStructureCreation,
  syncClientDriveBusinessFolders,
} from '../client-drive-structure-service'
import { GoogleDriveServiceError } from '../google-drive-errors'

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
    officeAdminFolderId: 'office',
    officeAdminFolderWebUrl: 'https://drive.example/office',
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
      create: vi.fn().mockResolvedValue(folderRow({
        status: 'CREATING',
        rootFolderId: null,
        rootFolderWebUrl: null,
        amWorkFolderId: null,
        amWorkFolderWebUrl: null,
        officeAdminFolderId: null,
        officeAdminFolderWebUrl: null,
        sharedFolderId: null,
        sharedFolderWebUrl: null,
      })),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue(folderRow({
        status: 'CREATING',
        rootFolderId: null,
        rootFolderWebUrl: null,
        amWorkFolderId: null,
        amWorkFolderWebUrl: null,
        officeAdminFolderId: null,
        officeAdminFolderWebUrl: null,
        sharedFolderId: null,
        sharedFolderWebUrl: null,
      })),
    },
    clientDriveFolderNode: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    ...overrides,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  let folderSequence = 0
  driveMocks.createGoogleDriveClientForConnection.mockReturnValue({ files: {} })
  driveMocks.findGoogleDriveFolderByAppProperties.mockResolvedValue(null)
  driveMocks.createGoogleDriveFolder.mockImplementation(async (_drive, input) => {
    folderSequence += 1
    return {
      id: `created_${folderSequence}`,
      name: input.name,
      webViewLink: `https://drive.example/created_${folderSequence}`,
    }
  })
  driveMocks.updateGoogleDriveFolder.mockImplementation(async (_drive, input) => ({
    id: input.folderId,
    name: input.name ?? null,
    webViewLink: `https://drive.example/${input.folderId}`,
  }))
  driveMocks.grantGoogleDrivePermissionsSequentially.mockResolvedValue([])
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
    expect(options.businessNames).toEqual(['Acme LLC'])
    expect(options.currentYear).toBe(new Date().getFullYear())
    expect(options.defaultState).toBe('TX')
  })

  it('reconciles existing READY folders instead of returning before provider work', async () => {
    const existing = folderRow()
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
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
    expect((db as { clientDriveFolder: { updateMany: ReturnType<typeof vi.fn> } }).clientDriveFolder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: existing.id, status: 'READY' }),
    }))
    expect(driveMocks.updateGoogleDriveFolder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      folderId: 'office',
      name: 'OFFICE - ADMIN ONLY',
    }))
    expect((db as { clientDriveFolderNode: { create: ReturnType<typeof vi.fn> } }).clientDriveFolderNode.create).toHaveBeenCalled()
  })

  it('creates office, shared-year, and linked business folders with role-based Drive email grants', async () => {
    const year = new Date().getFullYear()
    const owner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'Acme LLC',
            email: 'owner@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const createdRow = folderRow({
      status: 'CREATING',
      clientGroupId: 'group_1',
      rootFolderId: null,
      rootFolderWebUrl: null,
      amWorkFolderId: null,
      amWorkFolderWebUrl: null,
      officeAdminFolderId: null,
      officeAdminFolderWebUrl: null,
      sharedFolderId: null,
      sharedFolderWebUrl: null,
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      staff: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { id: 'admin_1', name: 'Admin', email: 'Admin@Test.COM', driveEmails: ['DriveAdmin@Test.COM'] },
          ])
          .mockResolvedValueOnce([
            { id: 'manager_1', name: 'Manager', email: 'Manager@Test.COM', driveEmails: [] },
          ]),
      },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdRow),
        update: vi.fn().mockResolvedValue(createdRow),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(createdRow),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    const response = await createClientDriveStructure({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'SINGLE_BUSINESS',
        businessName: 'Acme LLC',
        accountManagerStaffIds: [],
        clientEmail: 'owner@test.com',
        sendNotificationEmail: false,
      },
    }, db)

    const createdNames = driveMocks.createGoogleDriveFolder.mock.calls.map((call) => call[1].name)
    expect(createdNames).toEqual(expect.arrayContaining([
      'Linh Nguyen 1234 - TX - Acme LLC',
      'AM WORK',
      'OFFICE - ADMIN ONLY',
      'ADMIN Docs',
      'LLC Docs',
      'SHARED TO CLIENT',
      `${year} TAX DOCS`,
      `${year}-Paystubs`,
      `${year}-Receipts`,
      `${year}-Statements`,
      'Acme LLC',
      `${year}-Cash plan`,
      `${year}-Other Docs`,
    ]))
    expect((db as { clientDriveFolderNode: { create: ReturnType<typeof vi.fn> } }).clientDriveFolderNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'BUSINESS_ROOT',
        businessClientId: 'business_1',
        name: 'Acme LLC',
      }),
    })
    expect(response.permissionSummary).toEqual({
      adminGroupEmail: null,
      adminEmails: ['driveadmin@test.com'],
      accountManagerEmails: ['manager@test.com'],
      clientEmail: 'owner@test.com',
    })
    const grantedEmails = driveMocks.grantGoogleDrivePermissionsSequentially.mock.calls.map((call) => call[1][0].email)
    expect(grantedEmails).toEqual(expect.arrayContaining([
      'driveadmin@test.com',
      'manager@test.com',
      'owner@test.com',
    ]))
  })

  it('refreshes linked businesses before full structure creation writes business folders', async () => {
    const initialOwner = clientRow()
    const latestOwner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_2',
            firstName: '',
            lastName: null,
            name: 'COMPANY 2',
            email: 'company2@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const createdRow = folderRow({
      status: 'CREATING',
      rootFolderId: null,
      rootFolderWebUrl: null,
      amWorkFolderId: null,
      amWorkFolderWebUrl: null,
      officeAdminFolderId: null,
      officeAdminFolderWebUrl: null,
      sharedFolderId: null,
      sharedFolderWebUrl: null,
    })
    const db = baseDb({
      client: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(initialOwner)
          .mockResolvedValueOnce(latestOwner),
      },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdRow),
        update: vi.fn().mockResolvedValue(createdRow),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(createdRow),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await createClientDriveStructure({
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

    const createdNames = driveMocks.createGoogleDriveFolder.mock.calls.map((call) => call[1].name)
    expect(createdNames).toEqual(expect.arrayContaining(['COMPANY 2']))
    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenCalledWith({
      where: { id: createdRow.id },
      data: { clientGroupId: 'group_1' },
    })
  })

  it('reuses and renames folders found with old CORP_ADMIN appProperties', async () => {
    const existing = folderRow({
      status: 'FAILED',
      officeAdminFolderId: null,
      officeAdminFolderWebUrl: null,
      permissionSnapshot: {
        adminGroupEmail: null,
        adminEmails: [],
        accountManagerEmails: [],
        clientEmail: 'client@test.com',
        appliedPermissionKeys: [],
      },
    })
    driveMocks.findGoogleDriveFolderByAppProperties.mockImplementation(async (_drive, input) => {
      if (input.appProperties.ellaFolderRole === 'CORP_ADMIN') {
        return {
          id: 'old_corp_admin',
          name: 'CORP ADMIN',
          webViewLink: 'https://drive.example/old_corp_admin',
        }
      }
      return null
    })
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await createClientDriveStructure({
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

    expect(driveMocks.updateGoogleDriveFolder).toHaveBeenCalledWith(expect.anything(), {
      folderId: 'old_corp_admin',
      name: 'OFFICE - ADMIN ONLY',
      appProperties: expect.objectContaining({ ellaFolderRole: 'OFFICE_ADMIN_ONLY' }),
    })
    const createdNames = driveMocks.createGoogleDriveFolder.mock.calls.map((call) => call[1].name)
    expect(createdNames).not.toContain('OFFICE - ADMIN ONLY')
  })

  it('creates a replacement office admin folder when a saved folder id was deleted', async () => {
    const existing = folderRow({
      status: 'FAILED',
      officeAdminFolderId: 'deleted_office',
      officeAdminFolderWebUrl: 'https://drive.example/deleted_office',
      permissionSnapshot: {
        adminGroupEmail: null,
        adminEmails: [],
        accountManagerEmails: [],
        clientEmail: 'client@test.com',
        appliedPermissionKeys: [],
      },
    })
    driveMocks.updateGoogleDriveFolder.mockImplementation(async (_drive, input) => {
      if (input.folderId === 'deleted_office') {
        throw Object.assign(new Error('Folder not found'), { response: { status: 404 } })
      }
      return {
        id: input.folderId,
        name: input.name ?? null,
        webViewLink: `https://drive.example/${input.folderId}`,
      }
    })
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await createClientDriveStructure({
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

    expect(driveMocks.findGoogleDriveFolderByAppProperties).toHaveBeenCalled()
    expect(driveMocks.createGoogleDriveFolder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      name: 'OFFICE - ADMIN ONLY',
      parentFolderId: 'root_folder',
    }))
    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        officeAdminFolderId: expect.stringMatching(/^created_/),
        officeAdminFolderWebUrl: expect.stringMatching(/^https:\/\/drive\.example\/created_/),
      }),
    })
  })

  it('rejects concurrent recent CREATING rows before external Drive creates', async () => {
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(folderRow({
          status: 'CREATING',
          updatedAt: new Date(),
          rootFolderId: null,
          amWorkFolderId: null,
          officeAdminFolderId: null,
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
      officeAdminFolderId: null,
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

  it('queues structure creation without calling Google Drive', async () => {
    const createdRow = folderRow({
      status: 'CREATING',
      rootFolderId: null,
      rootFolderWebUrl: null,
      amWorkFolderId: null,
      amWorkFolderWebUrl: null,
      officeAdminFolderId: null,
      officeAdminFolderWebUrl: null,
      sharedFolderId: null,
      sharedFolderWebUrl: null,
      inputSnapshot: {
        ownerClientId: CLIENT_ID,
        clientGroupId: null,
        folderName: 'Linh Nguyen 1234 - TX - Multi',
        clientName: 'Linh Nguyen',
        ssnLast4: '1234',
        state: 'TX',
        entityLabel: 'Multi',
      },
    })
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdRow),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(createdRow),
      },
    })

    const response = await queueClientDriveStructureCreation({
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

    expect(response.folder?.status).toBe('CREATING')
    expect(response.queuedEvent).toEqual({
      rowId: 'drive_folder_row',
      rowUpdatedAt: '2026-08-10T00:00:00.000Z',
      inputSnapshot: {
        folderName: 'Linh Nguyen 1234 - TX - Multi',
        ssnLast4: '1234',
        state: 'TX',
        entityLabel: 'Multi',
      },
    })
    expect(driveMocks.createGoogleDriveClientForConnection).not.toHaveBeenCalled()
    expect(driveMocks.createGoogleDriveFolder).not.toHaveBeenCalled()
  })

  it('skips stale queued events when the row has been claimed again', async () => {
    const db = baseDb({
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(folderRow({
          status: 'CREATING',
          updatedAt: new Date('2026-08-10T00:01:00.000Z'),
          inputSnapshot: {
            ownerClientId: CLIENT_ID,
            clientGroupId: null,
            folderName: 'Linh Nguyen 1234 - TX - Multi',
            clientName: 'Linh Nguyen',
            ssnLast4: '1234',
            state: 'TX',
            entityLabel: 'Multi',
          },
        })),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    })

    await expect(executeQueuedClientDriveStructureCreation({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      rowId: 'drive_folder_row',
      rowUpdatedAt: '2026-08-10T00:00:00.000Z',
      inputSnapshot: {
        folderName: 'Linh Nguyen 1234 - TX - Multi',
        ssnLast4: '1234',
        state: 'TX',
        entityLabel: 'Multi',
      },
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    }, db)).resolves.toEqual({ skipped: true, reason: 'STALE_EVENT' })

    expect(driveMocks.createGoogleDriveClientForConnection).not.toHaveBeenCalled()
    expect((db as { clientDriveFolder: { updateMany: ReturnType<typeof vi.fn> } }).clientDriveFolder.updateMany).not.toHaveBeenCalled()
  })

  it('no-ops business folder sync when Drive is disconnected or no structure exists', async () => {
    const disconnectedDb = baseDb({
      googleDriveConnection: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    })

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, disconnectedDb)).resolves.toEqual({ synced: false, businessClientIds: [] })
    expect((disconnectedDb as { clientDriveFolder: { findUnique: ReturnType<typeof vi.fn> } }).clientDriveFolder.findUnique).not.toHaveBeenCalled()

    const noStructureDb = baseDb()
    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, noStructureDb)).resolves.toEqual({ synced: false, businessClientIds: [] })
    expect(driveMocks.createGoogleDriveFolder).not.toHaveBeenCalled()
  })

  it('creates missing business folder nodes for an existing Drive structure', async () => {
    const year = new Date().getFullYear()
    const owner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'ALPHA MEDIA',
            email: 'alpha@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const existing = folderRow({
      clientGroupId: 'group_1',
      amWorkFolderId: 'am_work',
      nodes: [],
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn(),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, db)).resolves.toEqual({ synced: true, businessClientIds: ['business_1'] })

    const createdNames = driveMocks.createGoogleDriveFolder.mock.calls.map((call) => call[1].name)
    expect(createdNames).toEqual([
      'ALPHA MEDIA',
      `${year}-Cash plan`,
      `${year}-Other Docs`,
    ])
    expect((db as { clientDriveFolder: { updateMany: ReturnType<typeof vi.fn> } }).clientDriveFolder.updateMany).toHaveBeenCalledWith({
      where: {
        id: existing.id,
        status: 'READY',
        updatedAt: existing.updatedAt,
      },
      data: expect.objectContaining({
        clientGroupId: 'group_1',
        status: 'CREATING',
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    })
    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenLastCalledWith({
      where: { id: existing.id },
      data: {
        status: 'READY',
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
  })

  it('renames a single-business root folder to Multi when a second business is linked', async () => {
    const year = new Date().getFullYear()
    const owner = clientRow({
      firstName: 'An',
      lastName: 'Nguyen',
      name: 'An Nguyen',
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({
            id: CLIENT_ID,
            firstName: 'An',
            lastName: 'Nguyen',
            name: 'An Nguyen',
            clientGroupId: 'group_1',
          }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'Alpha Media',
            email: 'alpha@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'PA',
          }),
          clientRow({
            id: 'business_2',
            firstName: '',
            lastName: null,
            name: 'Beta Studio',
            email: 'beta@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'PA',
          }),
        ],
      },
    })
    const existing = folderRow({
      clientGroupId: 'group_1',
      folderName: 'An Nguyen 2321 - PA - Alpha Media',
      rootFolderId: 'root_single_business',
      rootFolderWebUrl: 'https://drive.example/root_single_business',
      amWorkFolderId: 'am_work',
      inputSnapshot: {
        ownerClientId: CLIENT_ID,
        clientGroupId: 'group_1',
        folderName: 'An Nguyen 2321 - PA - Alpha Media',
        clientName: 'An Nguyen',
        ssnLast4: '2321',
        state: 'PA',
        entityLabel: 'Alpha Media',
      },
      nodes: [],
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn(),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_2'],
    }, db)).resolves.toEqual({ synced: true, businessClientIds: ['business_2'] })

    expect(driveMocks.updateGoogleDriveFolder).toHaveBeenCalledWith(expect.anything(), {
      folderId: 'root_single_business',
      name: 'An Nguyen 2321 - PA - Multi',
      appProperties: expect.objectContaining({ ellaFolderRole: 'CLIENT_ROOT' }),
    })
    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        folderName: 'An Nguyen 2321 - PA - Multi',
        rootFolderId: 'root_single_business',
        rootFolderWebUrl: 'https://drive.example/root_single_business',
        inputSnapshot: expect.objectContaining({
          folderName: 'An Nguyen 2321 - PA - Multi',
          entityLabel: 'Multi',
        }),
      }),
    })
    const createdNames = driveMocks.createGoogleDriveFolder.mock.calls.map((call) => call[1].name)
    expect(createdNames).toEqual([
      'Beta Studio',
      `${year}-Cash plan`,
      `${year}-Other Docs`,
    ])
  })

  it('skips business folder sync during active structure creation', async () => {
    const owner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'ALPHA MEDIA',
            email: 'alpha@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const existing = folderRow({
      status: 'CREATING',
      updatedAt: new Date(),
      clientGroupId: 'group_1',
      amWorkFolderId: 'am_work',
      nodes: [],
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn(),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, db)).resolves.toEqual({ synced: false, businessClientIds: [] })

    expect((db as { clientDriveFolder: { updateMany: ReturnType<typeof vi.fn> } }).clientDriveFolder.updateMany).not.toHaveBeenCalled()
    expect(driveMocks.createGoogleDriveFolder).not.toHaveBeenCalled()
  })

  it('marks existing Drive rows failed when business folder sync hits Google errors', async () => {
    const owner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'ALPHA MEDIA',
            email: 'alpha@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const existing = folderRow({
      clientGroupId: 'group_1',
      amWorkFolderId: 'am_work',
      nodes: [],
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn(),
      },
      clientDriveFolderNode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    })
    driveMocks.createGoogleDriveFolder.mockRejectedValueOnce(
      new GoogleDriveServiceError('DRIVE_RATE_LIMITED')
    )

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, db)).rejects.toMatchObject({ code: 'DRIVE_RATE_LIMITED' })

    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenLastCalledWith({
      where: { id: existing.id },
      data: {
        status: 'FAILED',
        lastErrorCode: 'DRIVE_RATE_LIMITED',
        lastErrorMessage: 'Google Drive rate limit exceeded. Try again later.',
      },
    })
  })

  it('normalizes Drive client setup errors into retryable business sync failures', async () => {
    const owner = clientRow({
      clientGroupId: 'group_1',
      clientGroup: {
        id: 'group_1',
        clients: [
          clientRow({ id: CLIENT_ID, clientGroupId: 'group_1' }),
          clientRow({
            id: 'business_1',
            firstName: '',
            lastName: null,
            name: 'ALPHA MEDIA',
            email: 'alpha@test.com',
            clientType: 'BUSINESS',
            clientGroupId: 'group_1',
            businessState: 'TX',
          }),
        ],
      },
    })
    const existing = folderRow({
      clientGroupId: 'group_1',
      amWorkFolderId: 'am_work',
      nodes: [],
    })
    const db = baseDb({
      client: { findFirst: vi.fn().mockResolvedValue(owner) },
      clientDriveFolder: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(existing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn(),
      },
    })
    driveMocks.createGoogleDriveClientForConnection.mockImplementationOnce(() => {
      throw new Error('decrypt failed')
    })

    await expect(syncClientDriveBusinessFolders({
      organizationId: 'org_1',
      ownerOrRequestedClientId: CLIENT_ID,
      actorStaffId: 'staff_1',
      businessClientIds: ['business_1'],
    }, db)).rejects.toMatchObject({ code: 'DRIVE_ROOT_INVALID' })

    expect((db as { clientDriveFolder: { update: ReturnType<typeof vi.fn> } }).clientDriveFolder.update).toHaveBeenLastCalledWith({
      where: { id: existing.id },
      data: {
        status: 'FAILED',
        lastErrorCode: 'DRIVE_ROOT_INVALID',
        lastErrorMessage: 'Google Drive root folder is invalid or unavailable.',
      },
    })
  })
})
