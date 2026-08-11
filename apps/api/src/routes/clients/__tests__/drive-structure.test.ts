import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: { findFirst: vi.fn() },
}))
const serviceMocks = vi.hoisted(() => ({
  getClientDriveStructureStatus: vi.fn(),
  getClientDriveStructureOptions: vi.fn(),
  createClientDriveStructure: vi.fn(),
}))
const activityMocks = vi.hoisted(() => ({
  getAuditRequestContext: vi.fn(() => ({ route: '/clients/:id/drive-structure', method: 'POST' })),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../services/google-drive/client-drive-structure-service', () => serviceMocks)
vi.mock('../../../services/activity-log', () => activityMocks)

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
    defaultBusinessMode: 'MULTI',
    defaultBusinessName: null,
    defaultState: null,
    selectedAccountManagerStaffIds: [],
    staffOptions: [],
    existingFolder: null,
  })
  serviceMocks.createClientDriveStructure.mockResolvedValue({
    created: true,
    folder: {
      id: 'folder_row_1',
      organizationId: 'org_1',
      ownerClientId: CLIENT_ID,
      clientGroupId: null,
      folderName: 'Linh Nguyen 1234 - TX - Multi',
      rootFolderId: 'drive_root',
      rootFolderWebUrl: 'https://drive.example/root',
      amWorkFolderId: 'am_work',
      amWorkFolderWebUrl: 'https://drive.example/am',
      corpAdminFolderId: 'corp',
      corpAdminFolderWebUrl: 'https://drive.example/corp',
      sharedFolderId: 'shared',
      sharedFolderWebUrl: 'https://drive.example/shared',
      status: 'READY',
      inputSnapshot: {},
      permissionSnapshot: {},
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
    expect(serviceMocks.createClientDriveStructure).not.toHaveBeenCalled()
  })

  it('returns uniform 404 for inaccessible clients', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const response = await buildApp().request(`/clients/${CLIENT_ID}/drive-structure/options`)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'NOT_FOUND', message: 'Client not found' })
    expect(serviceMocks.getClientDriveStructureOptions).not.toHaveBeenCalled()
  })

  it('creates via the service and logs redacted activity metadata', async () => {
    const response = await buildApp().request(`/clients/${CLIENT_ID}/drive-structure`, {
      method: 'POST',
      body: JSON.stringify({
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: ['staff_MANAGER'],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(201)
    expect(serviceMocks.createClientDriveStructure).toHaveBeenCalledWith({
      organizationId: 'org_1',
      clientId: CLIENT_ID,
      actorStaffId: 'staff_MANAGER',
      payload: {
        ssnLast4: '1234',
        state: 'TX',
        businessMode: 'MULTI',
        accountManagerStaffIds: ['staff_MANAGER'],
        clientEmail: 'client@test.com',
        sendNotificationEmail: false,
      },
    })
    const activity = activityMocks.logStaffActivity.mock.calls[0]?.[0]
    expect(JSON.stringify(activity.metadata)).not.toContain('client@test.com')
    expect(JSON.stringify(activity.metadata)).not.toContain('drive_root')
  })
})
