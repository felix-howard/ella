/**
 * ManagedBy Propagation Unit Tests
 * Tests PATCH /clients/:id/managed-by
 * Covers: group propagation, null propagation, no-group client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockTransaction = vi.fn()
vi.mock('../../../lib/db', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    clientProfile: {
      findUnique: vi.fn(),
    },
    taxCase: {
      findFirst: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateClientAvatarKey: vi.fn(),
  resolveAvatarUrl: vi.fn().mockImplementation((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireAdminOrManager: async (
    c: {
      get: (key: string) => { orgRole?: string | null; role?: string | null }
      json: (body: unknown, status?: number) => Response
    },
    next: () => Promise<void>
  ) => {
    const user = c.get('user')
    if (!(user?.orgRole === 'org:admin' || user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
      return c.json({ error: 'Admin access required' }, 403)
    }
    return next()
  },
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn().mockReturnValue({ organizationId: 'org_1' }),
  canSeeAllClients: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../services/checklist-generator', () => ({
  generateChecklist: vi.fn(),
  cascadeCleanupOnFalse: vi.fn(),
  refreshChecklist: vi.fn(),
}))

vi.mock('../../../services/audit-logger', () => ({
  logProfileChanges: vi.fn(),
  computeIntakeAnswersDiff: vi.fn(),
  computeProfileFieldDiff: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '203.0.113.10',
    userAgent: 'Vitest',
    route: '/clients/id/managed-by',
    method: 'PATCH',
  })),
  getChangedFieldNames: vi.fn(() => ['managedById', 'managedByStaff']),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn().mockResolvedValue({ engagementId: 'engagement_1' }),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
  upgradeActivePortalLinksToGroup: vi.fn(),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(),
  sendWelcomeMessage: vi.fn(),
  getOrgSmsLanguage: vi.fn(),
}))

vi.mock('../../../services/crypto', () => ({
  encryptSSN: vi.fn(),
  maskEIN: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import type { AuthVariables } from '../../../middleware/auth'
import { clientsRoute } from '../index'

function createApp(user = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/clients', clientsRoute)
  return app
}

function defaultUser() {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

// CUID-format test IDs (must match /^c[a-z0-9]{24}$/)
const CID_1 = 'cabcdefghij1234567890cli1'
const CID_NOGR = 'cabcdefghij12345678nogr01'
const CID_2 = 'cabcdefghij1234567890cli2'
const STAFF_ALICE = 'cstaffalice12345678901234'
const STAFF_BOB = 'cstaffbob1234567890123456'
const STAFF_MISSING = 'cmissingstaff123456789012'

function createManagerTx(input?: {
  clientIds?: string[]
  updatedClientId?: string
  managerIds?: string[]
  validStaff?: boolean
}) {
  const clientIds = input?.clientIds ?? [CID_1, CID_2]
  const managerIds = input?.managerIds ?? [STAFF_ALICE]
  const staffRows = managerIds.map((id) => ({ id, name: id === STAFF_ALICE ? 'Alice' : 'Staff', avatarUrl: null }))

  const tx = {
    staff: {
      findMany: vi.fn().mockResolvedValue(input?.validStaff === false ? [] : staffRows.map(({ id }) => ({ id }))),
    },
    client: {
      findMany: vi.fn().mockResolvedValue(clientIds.map((id) => ({ id }))),
      updateMany: vi.fn().mockResolvedValue({ count: clientIds.length }),
      findUnique: vi.fn().mockResolvedValue({
        id: input?.updatedClientId ?? CID_1,
        name: 'Test Client',
        managedBy: staffRows[0] ?? null,
        managers: staffRows.map((staff) => ({ staff })),
      }),
    },
    clientManager: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: clientIds.length * managerIds.length }),
    },
  }

  return tx
}

describe('PATCH /clients/:id/managed-by', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates managedById to all group members', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(createManagerTx())
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: STAFF_ALICE }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.managedBy.name).toBe('Alice')
    expect(mockTransaction).toHaveBeenCalledOnce()
  })

  it('returns legacy managedBy from the synced primary staff id', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    const tx = createManagerTx({ managerIds: [STAFF_ALICE, STAFF_BOB] })
    tx.client.findUnique.mockResolvedValueOnce({
      id: CID_1,
      name: 'Test Client',
      managedBy: { id: STAFF_ALICE, name: 'Alice', avatarUrl: null },
      managers: [
        { staff: { id: STAFF_BOB, name: 'Bob', avatarUrl: null } },
        { staff: { id: STAFF_ALICE, name: 'Alice', avatarUrl: null } },
      ],
    })
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: [STAFF_ALICE, STAFF_BOB] }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.managedBy).toEqual({ id: STAFF_ALICE, name: 'Alice', avatarUrl: null })
    expect(json.data.managedByStaff.map((staff: { id: string }) => staff.id)).toEqual([STAFF_ALICE, STAFF_BOB])
    expect(tx.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [CID_1, CID_2] },
        organizationId: 'org_1',
      },
      data: { managedById: STAFF_ALICE },
    })
    expect(tx.clientManager.deleteMany).toHaveBeenCalledWith({
      where: {
        clientId: { in: [CID_1, CID_2] },
        organizationId: 'org_1',
        staffId: { notIn: [STAFF_ALICE, STAFF_BOB] },
      },
    })
    expect(tx.clientManager.createMany).toHaveBeenCalledWith({
      data: [
        { clientId: CID_1, staffId: STAFF_ALICE, organizationId: 'org_1' },
        { clientId: CID_1, staffId: STAFF_BOB, organizationId: 'org_1' },
        { clientId: CID_2, staffId: STAFF_ALICE, organizationId: 'org_1' },
        { clientId: CID_2, staffId: STAFF_BOB, organizationId: 'org_1' },
      ],
      skipDuplicates: true,
    })
  })

  it('verifies updateMany is called with correct group filter', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    const tx = createManagerTx()
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: STAFF_ALICE }),
    })

    expect(tx.client.findMany).toHaveBeenCalledWith({
      where: {
        clientGroupId: 'group_1',
        organizationId: 'org_1',
      },
      select: { id: true },
    })
    expect(tx.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [CID_1, CID_2] },
        organizationId: 'org_1',
      },
      data: { managedById: STAFF_ALICE },
    })
    expect(tx.clientManager.createMany).toHaveBeenCalledWith({
      data: [
        { clientId: CID_1, staffId: STAFF_ALICE, organizationId: 'org_1' },
        { clientId: CID_2, staffId: STAFF_ALICE, organizationId: 'org_1' },
      ],
      skipDuplicates: true,
    })
    expect(tx.clientManager.deleteMany).toHaveBeenCalledWith({
      where: {
        clientId: { in: [CID_1, CID_2] },
        organizationId: 'org_1',
        staffId: { notIn: [STAFF_ALICE] },
      },
    })
  })

  it('propagates null (unassign) to all group members', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    const tx = createManagerTx({ managerIds: [] })
    tx.client.findUnique.mockResolvedValueOnce({
      id: CID_1,
      name: 'Test Client',
      managedBy: null,
      managers: [],
    })
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: null }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.managedBy).toBeNull()
    expect(tx.clientManager.deleteMany).toHaveBeenCalledWith({
      where: {
        clientId: { in: [CID_1, CID_2] },
        organizationId: 'org_1',
      },
    })
    expect(tx.clientManager.createMany).not.toHaveBeenCalled()
  })

  it('does not propagate when client has no group', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_NOGR,
      clientGroupId: null,
      name: 'No Group Client',
    } as never)

    const tx = createManagerTx({ clientIds: [CID_NOGR], updatedClientId: CID_NOGR })
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_NOGR}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: STAFF_ALICE }),
    })

    expect(res.status).toBe(200)
    expect(tx.client.findMany).not.toHaveBeenCalled()
    expect(tx.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [CID_NOGR] },
        organizationId: 'org_1',
      },
      data: { managedById: STAFF_ALICE },
    })
  })

  it('returns 404 when client not found', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(null as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: STAFF_ALICE }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when legacy manager is cross-org or inactive', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    const tx = createManagerTx({ managerIds: [STAFF_MISSING], validStaff: false })
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: STAFF_MISSING }),
    })

    expect(res.status).toBe(404)
    expect(tx.staff.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [STAFF_MISSING] },
        organizationId: 'org_1',
        isActive: true,
      },
      select: { id: true },
    })
    expect(tx.clientManager.createMany).not.toHaveBeenCalled()
  })

  it('rejects mixed valid and cross-org or inactive manager IDs without partial writes', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
      name: 'Test Client',
    } as never)

    const tx = createManagerTx({ managerIds: [STAFF_ALICE, STAFF_MISSING] })
    tx.staff.findMany.mockResolvedValueOnce([{ id: STAFF_ALICE }])
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: [STAFF_ALICE, STAFF_MISSING] }),
    })

    expect(res.status).toBe(404)
    expect(tx.staff.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [STAFF_ALICE, STAFF_MISSING] },
        organizationId: 'org_1',
        isActive: true,
      },
      select: { id: true },
    })
    expect(tx.client.findMany).not.toHaveBeenCalled()
    expect(tx.client.updateMany).not.toHaveBeenCalled()
    expect(tx.clientManager.deleteMany).not.toHaveBeenCalled()
    expect(tx.clientManager.createMany).not.toHaveBeenCalled()
  })

  it('forbids non-admin manager updates', async () => {
    const app = createApp({
      ...defaultUser(),
      role: 'STAFF',
      orgRole: 'org:member',
    })
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: [STAFF_ALICE] }),
    })

    expect(res.status).toBe(403)
    expect(prisma.client.findFirst).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

describe('POST /clients/:id/link-business manager inheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.clientProfile.findUnique).mockResolvedValue({ id: 'profile_1' } as never)
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValue(null as never)
  })

  it('syncs linked business to the parent full manager set with parent primary first', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      name: 'Parent Client',
      clientType: 'INDIVIDUAL',
      clientGroup: { id: 'group_1', name: 'Parent Group' },
      managedById: STAFF_BOB,
      managers: [
        { staffId: STAFF_ALICE },
        { staffId: STAFF_BOB },
      ],
    } as never)

    const tx = {
      client: {
        create: vi.fn().mockResolvedValue({
          id: CID_2,
          name: 'Acme LLC',
          clientType: 'BUSINESS',
          businessType: 'LLC',
          profile: { id: 'profile_1' },
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      clientGroup: {
        create: vi.fn(),
      },
      taxCase: {
        create: vi.fn().mockResolvedValue({ id: 'case_1', taxYear: 2025 }),
      },
      clientManager: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    }
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/link-business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Acme LLC',
        phone: '+15551234567',
        language: 'EN',
        businessType: 'LLC',
        taxYear: 2025,
      }),
    })

    expect(res.status).toBe(201)
    expect(tx.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [CID_2] },
        organizationId: 'org_1',
      },
      data: { managedById: STAFF_BOB },
    })
    expect(tx.clientManager.createMany).toHaveBeenCalledWith({
      data: [
        { clientId: CID_2, staffId: STAFF_BOB, organizationId: 'org_1' },
        { clientId: CID_2, staffId: STAFF_ALICE, organizationId: 'org_1' },
      ],
      skipDuplicates: true,
    })
  })
})
