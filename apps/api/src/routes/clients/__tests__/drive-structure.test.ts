import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
}))
const serviceMocks = vi.hoisted(() => ({
  getClientDriveStructureStatus: vi.fn(),
  getClientDriveStructureOptions: vi.fn(),
  queueClientDriveStructureCreation: vi.fn(),
  markQueuedClientDriveStructureDispatchFailed: vi.fn(),
}))
const inngestMocks = vi.hoisted(() => ({
  send: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/inngest', () => ({ inngest: inngestMocks }))
vi.mock('../../../services/google-drive/client-drive-structure-service', () => serviceMocks)

import { clientsDriveStructureRoute } from '../drive-structure'

const CLIENT_ID = 'caaaaaaaaaaaaaaaaaaaaaaaa'

function buildApp(role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'MANAGER') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: `clerk_${role}`,
      staffId: `staff_${role}`,
      email: `${role.toLowerCase()}@test.com`,
      name: `${role} User`,
      role,
      organizationId: 'org_1',
      clerkOrgId: 'org_clerk_1',
      orgRole: role === 'ADMIN' ? 'org:admin' : 'org:member',
    })
    await next()
  })
  app.route('/clients', clientsDriveStructureRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.client.findFirst.mockResolvedValue({ id: CLIENT_ID, name: 'Linh Nguyen' })
  serviceMocks.getClientDriveStructureStatus.mockResolvedValue({ folder: null, permissionSummary: null, warnings: [] })
  serviceMocks.getClientDriveStructureOptions.mockResolvedValue({
    ownerClientId: CLIENT_ID,
    clientGroupId: null,
    clientName: 'Linh Nguyen',
    clientEmail: 'client@test.com',
    currentYear: 2026,
    businessNames: [],
    defaultBusinessMode: 'MULTI',
    defaultBusinessName: null,
    defaultState: null,
    selectedAccountManagerStaffIds: [],
    staffOptions: [],
    existingFolder: null,
  })
  inngestMocks.send.mockResolvedValue({ ids: ['evt_1'] })
  serviceMocks.queueClientDriveStructureCreation.mockResolvedValue({
    created: true,
    folder: {
      id: 'folder_row_1',
      organizationId: 'org_1',
      ownerClientId: CLIENT_ID,
      clientGroupId: null,
      folderName: 'Linh Nguyen 1234-TX-Multi',
      rootFolderId: null,
      rootFolderWebUrl: null,
      amWorkFolderId: null,
      amWorkFolderWebUrl: null,
      officeAdminFolderId: null,
      officeAdminFolderWebUrl: null,
      sharedFolderId: null,
      sharedFolderWebUrl: null,
      status: 'CREATING',
      inputSnapshot: {
        ownerClientId: CLIENT_ID,
        clientGroupId: null,
        folderName: 'Linh Nguyen 1234-TX-Multi',
        clientName: 'Linh Nguyen',
        ssnLast4: '1234',
        state: 'TX',
        entityLabel: 'Multi',
      },
      permissionSnapshot: {
        accountManagerEmails: ['manager@test.com'],
        adminGroupEmail: null,
        adminEmails: ['admin@test.com'],
        clientEmail: 'client@test.com',
      },
      lastErrorCode: null,
      lastErrorMessage: null,
      createdByStaffId: 'staff_MANAGER',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    },
    permissionSummary: {
      accountManagerEmails: ['manager@test.com'],
      adminGroupEmail: null,
      adminEmails: ['admin@test.com'],
      clientEmail: 'client@test.com',
    },
    warnings: [],
    queuedEvent: {
      rowId: 'folder_row_1',
      rowUpdatedAt: '2026-08-10T00:00:00.000Z',
      inputSnapshot: {
        folderName: 'Linh Nguyen 1234-TX-Multi',
        ssnLast4: '1234',
        state: 'TX',
        entityLabel: 'Multi',
      },
    },
  })
})

describe('client Drive structure routes', () => {
  it('rejects non-admin/non-manager create access', async () => {
    const response = await buildApp('STAFF').request(`/clients/${CLIENT_ID}/drive-structure`, {
      method: 'POST',
      body: JSON.stringify({
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(403)
    expect(serviceMocks.queueClientDriveStructureCreation).not.toHaveBeenCalled()
    expect(inngestMocks.send).not.toHaveBeenCalled()
  })

  it('returns uniform 404 for inaccessible clients', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const response = await buildApp().request(`/clients/${CLIENT_ID}/drive-structure/options`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'NOT_FOUND', message: 'Client not found' })
    expect(serviceMocks.getClientDriveStructureOptions).not.toHaveBeenCalled()
  })

  it('queues Drive structure creation through Inngest and returns the CREATING row', async () => {
    const response = await buildApp().request(`/clients/${CLIENT_ID}/drive-structure`, {
      method: 'POST',
      body: JSON.stringify({
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(202)
    expect(serviceMocks.queueClientDriveStructureCreation).toHaveBeenCalledWith({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_MANAGER',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: [],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    })
    expect(inngestMocks.send).toHaveBeenCalledWith({
      name: 'client/drive-structure.create',
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: CLIENT_ID,
        actorStaffId: 'staff_MANAGER',
        rowId: 'folder_row_1',
        rowUpdatedAt: '2026-08-10T00:00:00.000Z',
        payload: expect.objectContaining({
          ssnLast4: '1234',
          state: 'TX',
          businessMode: 'MULTI',
        }),
      }),
    })
    const body = await response.json()
    expect(body.folder.status).toBe('CREATING')
    expect(JSON.stringify(body)).not.toContain('queuedEvent')
  })

  it('marks the row failed when Inngest dispatch fails', async () => {
    inngestMocks.send.mockRejectedValueOnce(new Error('Inngest unavailable'))

    const response = await buildApp().request(`/clients/${CLIENT_ID}/drive-structure`, {
      method: 'POST',
      body: JSON.stringify({
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'DRIVE_QUEUE_FAILED',
      message: 'Could not queue Google Drive folder creation. Try again later.',
    })
    expect(serviceMocks.markQueuedClientDriveStructureDispatchFailed).toHaveBeenCalledWith({
      organizationId: 'org_1',
      rowId: 'folder_row_1',
      message: 'Inngest unavailable',
    })
  })
})
