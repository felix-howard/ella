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
      update: vi.fn(),
      updateMany: vi.fn(),
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
  requireOrgAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn().mockReturnValue({ organizationId: 'org_1' }),
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

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn(),
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

describe('PATCH /clients/:id/managed-by', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates managedById to all group members', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
    } as never)

    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff_alice',
      name: 'Alice',
      organizationId: 'org_1',
      isActive: true,
    } as never)

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          update: vi.fn().mockResolvedValue({
            id: CID_1,
            managedById: 'staff_alice',
            managedBy: { id: 'staff_alice', name: 'Alice', avatarUrl: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      }
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'staff_alice' }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.managedBy.name).toBe('Alice')
    expect(mockTransaction).toHaveBeenCalledOnce()
  })

  it('verifies updateMany is called with correct group filter', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
    } as never)

    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff_alice',
      name: 'Alice',
      organizationId: 'org_1',
      isActive: true,
    } as never)

    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 2 })
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          update: vi.fn().mockResolvedValue({
            id: CID_1,
            managedById: 'staff_alice',
            managedBy: { id: 'staff_alice', name: 'Alice', avatarUrl: null },
          }),
          updateMany: mockUpdateMany,
        },
      }
      return fn(tx)
    })

    const app = createApp()
    await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'staff_alice' }),
    })

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        clientGroupId: 'group_1',
        id: { not: CID_1 },
        organizationId: 'org_1',
      },
      data: { managedById: 'staff_alice' },
    })
  })

  it('propagates null (unassign) to all group members', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
    } as never)

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          update: vi.fn().mockResolvedValue({
            id: CID_1,
            managedById: null,
            managedBy: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      }
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
  })

  it('does not propagate when client has no group', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_NOGR,
      clientGroupId: null,
    } as never)

    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
      id: 'staff_alice',
      name: 'Alice',
      organizationId: 'org_1',
      isActive: true,
    } as never)

    const mockUpdateMany = vi.fn()
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        client: {
          update: vi.fn().mockResolvedValue({
            id: CID_NOGR,
            managedById: 'staff_alice',
            managedBy: { id: 'staff_alice', name: 'Alice', avatarUrl: null },
          }),
          updateMany: mockUpdateMany,
        },
      }
      return fn(tx)
    })

    const app = createApp()
    const res = await app.request(`/clients/${CID_NOGR}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'staff_alice' }),
    })

    expect(res.status).toBe(200)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when client not found', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(null as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'staff_1' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when staff not found', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_1,
      clientGroupId: 'group_1',
    } as never)

    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_1}/managed-by`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'nonexistent_staff_id_here' }),
    })

    expect(res.status).toBe(404)
  })
})
