import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

const mockTransaction = vi.fn()
const prismaMocks = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  clientGroup: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  clientDriveFolder: {
    updateMany: vi.fn(),
  },
  $transaction: (...args: unknown[]) => mockTransaction(...args),
}))
const driveStructureMocks = vi.hoisted(() => ({
  syncClientDriveBusinessFolders: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn().mockReturnValue({ organizationId: 'org_1' }),
  canSeeAllClients: vi.fn().mockReturnValue(true),
}))
vi.mock('../../../services/google-drive/client-drive-structure-service', () => driveStructureMocks)
vi.mock('../../../services/identity-doc-retention', () => ({
  isCaseFiled: vi.fn(),
  scheduleIdentityRetentionForFiledCase: vi.fn(),
}))

import { clientGroupsRoute } from '../index'
import { GoogleDriveServiceError } from '../../../services/google-drive/google-drive-errors'

const GROUP_ID = 'cabcdefghij1234567890grp1'
const BUSINESS_ID = 'cabcdefghij1234567890biz1'
const INDIVIDUAL_ID = 'cabcdefghij1234567890ind1'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      staffId: 'staff_1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      organizationId: 'org_1',
      clerkOrgId: 'org_clerk_1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/client-groups', clientGroupsRoute)
  return app
}

function groupPayload() {
  return {
    id: GROUP_ID,
    name: 'Updated Group',
    clients: [
      {
        id: BUSINESS_ID,
        firstName: 'ALPHA MEDIA',
        lastName: null,
        name: 'ALPHA MEDIA',
        clientType: 'BUSINESS',
        phone: '+15551234567',
        email: 'alpha@test.com',
        avatarUrl: null,
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.clientGroup.findFirst.mockResolvedValue({ id: GROUP_ID })
  prismaMocks.client.findMany.mockResolvedValue([
    { id: BUSINESS_ID, clientType: 'BUSINESS' },
    { id: INDIVIDUAL_ID, clientType: 'INDIVIDUAL' },
  ])
  driveStructureMocks.syncClientDriveBusinessFolders.mockResolvedValue({
    synced: true,
    businessClientIds: [BUSINESS_ID],
  })
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      clientGroup: {
        update: vi.fn().mockResolvedValue({ id: GROUP_ID }),
        findUnique: vi.fn().mockResolvedValue(groupPayload()),
      },
      client: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    })
  })
})

describe('PATCH /client-groups/:id Drive business sync', () => {
  it('syncs added business client folders after group update commits', async () => {
    const response = await createApp().request(`/client-groups/${GROUP_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        addClientIds: [BUSINESS_ID, INDIVIDUAL_ID],
      }),
    })

    expect(response.status).toBe(200)
    expect(driveStructureMocks.syncClientDriveBusinessFolders).toHaveBeenCalledWith({
      organizationId: 'org_1',
      ownerOrRequestedClientId: BUSINESS_ID,
      actorStaffId: 'staff_1',
      businessClientIds: [BUSINESS_ID],
    })
  })

  it('keeps group update successful when Drive sync is retryable', async () => {
    prismaMocks.client.findMany.mockResolvedValueOnce([
      { id: BUSINESS_ID, clientType: 'BUSINESS' },
    ])
    driveStructureMocks.syncClientDriveBusinessFolders.mockRejectedValueOnce(
      new GoogleDriveServiceError('DRIVE_RATE_LIMITED')
    )

    const response = await createApp().request(`/client-groups/${GROUP_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        addClientIds: [BUSINESS_ID],
      }),
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.id).toBe(GROUP_ID)
    expect(mockTransaction).toHaveBeenCalledOnce()
  })
})
