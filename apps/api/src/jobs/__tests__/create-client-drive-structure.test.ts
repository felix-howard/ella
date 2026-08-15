import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/inngest', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({ config, trigger, handler })),
  },
}))

const prismaMocks = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
}))
const serviceMocks = vi.hoisted(() => ({
  executeQueuedClientDriveStructureCreation: vi.fn(),
}))
const activityMocks = vi.hoisted(() => ({
  logStaffActivity: vi.fn(),
}))
const smsMocks = vi.hoisted(() => ({
  sendDriveSharedFolderMessage: vi.fn(),
}))

vi.mock('../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../services/google-drive/client-drive-structure-service', () => serviceMocks)
vi.mock('../../services/activity-log', () => activityMocks)
vi.mock('../../services/sms/message-sender', () => smsMocks)

import { createClientDriveStructureJob } from '../create-client-drive-structure'

const eventData = {
  organizationId: 'org_1',
  clientId: 'client_1',
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
    businessMode: 'MULTI' as const,
    accountManagerStaffIds: [],
    clientEmail: 'client@test.com',
    sendNotificationEmail: false,
  },
}

function stepRunner() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  }
}

function handler() {
  return (createClientDriveStructureJob as unknown as {
    handler: (input: { event: { data: typeof eventData }; step: ReturnType<typeof stepRunner> }) => Promise<unknown>
  }).handler
}

describe('createClientDriveStructureJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.client.findFirst.mockResolvedValue({ id: 'client_1', name: 'Linh Nguyen' })
    smsMocks.sendDriveSharedFolderMessage.mockResolvedValue({
      success: true,
      skipped: false,
      smsSent: true,
      messageId: 'msg_drive_shared',
    })
  })

  it('executes queued Drive creation, sends shared folder SMS, and logs after the folder is ready', async () => {
    serviceMocks.executeQueuedClientDriveStructureCreation.mockResolvedValue({
      created: true,
      folder: {
        id: 'drive_folder_row',
        organizationId: 'org_1',
        ownerClientId: 'client_1',
        clientGroupId: null,
        folderName: 'Linh Nguyen 1234 - TX - Multi',
        rootFolderId: 'root_1',
        rootFolderWebUrl: 'https://drive.example/root',
        amWorkFolderId: 'am_1',
        amWorkFolderWebUrl: 'https://drive.example/am',
        officeAdminFolderId: 'office_1',
        officeAdminFolderWebUrl: 'https://drive.example/office',
        sharedFolderId: 'shared_1',
        sharedFolderWebUrl: 'https://drive.example/shared',
        status: 'READY',
        inputSnapshot: {},
        permissionSnapshot: {},
        lastErrorCode: null,
        lastErrorMessage: null,
        createdByStaffId: 'staff_1',
        createdAt: '',
        updatedAt: '',
      },
      permissionSummary: {
        accountManagerEmails: ['manager@test.com'],
        adminGroupEmail: null,
        adminEmails: ['admin@test.com'],
        clientEmail: 'client@test.com',
      },
      warnings: [],
    })

    const result = await handler()({
      event: { data: eventData },
      step: stepRunner(),
    })

    expect(result).toMatchObject({ folder: { status: 'READY' } })
    expect(serviceMocks.executeQueuedClientDriveStructureCreation).toHaveBeenCalledWith(eventData)
    expect(smsMocks.sendDriveSharedFolderMessage).toHaveBeenCalledWith({
      organizationId: 'org_1',
      ownerClientId: 'client_1',
      clientDriveFolderId: 'drive_folder_row',
      sharedFolderId: 'shared_1',
      sharedFolderWebUrl: 'https://drive.example/shared',
      actorStaffId: 'staff_1',
    })
    expect(activityMocks.logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      clientId: 'client_1',
      actorStaffId: 'staff_1',
      summary: 'Created Google Drive folder structure',
      metadata: expect.objectContaining({
        status: 'READY',
        permissionTargetCounts: {
          accountManagers: 1,
          admins: 1,
          hasAdminGroup: false,
          hasClient: true,
        },
      }),
    }))
  })

  it('does not log activity when execution is skipped', async () => {
    serviceMocks.executeQueuedClientDriveStructureCreation.mockResolvedValue({
      skipped: true,
      reason: 'STALE_EVENT',
    })

    await expect(handler()({
      event: { data: eventData },
      step: stepRunner(),
    })).resolves.toEqual({ skipped: true, reason: 'STALE_EVENT' })

    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
    expect(smsMocks.sendDriveSharedFolderMessage).not.toHaveBeenCalled()
  })

  it('sends shared folder SMS when a retry finds the folder already ready', async () => {
    serviceMocks.executeQueuedClientDriveStructureCreation.mockResolvedValue({
      skipped: true,
      reason: 'ALREADY_READY',
    })

    await expect(handler()({
      event: { data: eventData },
      step: stepRunner(),
    })).resolves.toEqual({ skipped: true, reason: 'ALREADY_READY' })

    expect(smsMocks.sendDriveSharedFolderMessage).toHaveBeenCalledWith({
      organizationId: 'org_1',
      clientDriveFolderId: 'drive_folder_row',
      actorStaffId: 'staff_1',
    })
    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
  })

  it('lets unexpected shared folder SMS errors fail the job for Inngest retry', async () => {
    serviceMocks.executeQueuedClientDriveStructureCreation.mockResolvedValue({
      created: true,
      folder: {
        id: 'drive_folder_row',
        organizationId: 'org_1',
        ownerClientId: 'client_1',
        clientGroupId: null,
        folderName: 'Linh Nguyen 1234 - TX - Multi',
        rootFolderId: 'root_1',
        rootFolderWebUrl: 'https://drive.example/root',
        amWorkFolderId: 'am_1',
        amWorkFolderWebUrl: 'https://drive.example/am',
        officeAdminFolderId: 'office_1',
        officeAdminFolderWebUrl: 'https://drive.example/office',
        sharedFolderId: 'shared_1',
        sharedFolderWebUrl: 'https://drive.example/shared',
        status: 'READY',
        inputSnapshot: {},
        permissionSnapshot: {},
        lastErrorCode: null,
        lastErrorMessage: null,
        createdByStaffId: 'staff_1',
        createdAt: '',
        updatedAt: '',
      },
      permissionSummary: null,
      warnings: [],
    })
    smsMocks.sendDriveSharedFolderMessage.mockRejectedValueOnce(new Error('Twilio timeout'))

    await expect(handler()({
      event: { data: eventData },
      step: stepRunner(),
    })).rejects.toThrow('Twilio timeout')

    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
  })
})
