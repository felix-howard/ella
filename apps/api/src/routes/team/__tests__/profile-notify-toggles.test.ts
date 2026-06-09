/**
 * Tests for the ADMIN-only agreement/payment notification toggles on
 * PATCH /team/members/:staffId/profile. Non-admin targets must get an
 * explicit 403 (not a silent drop); existing toggles stay role-agnostic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateAvatarKey: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  resolveAvatarUrl: vi.fn().mockImplementation((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../lib/config', () => ({
  config: { workspaceUrl: 'http://localhost:5174' },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {},
    users: { updateUser: vi.fn() },
  },
}))

vi.mock('../../../services/auth', () => ({
  deactivateStaff: vi.fn(),
}))

vi.mock('../../../services/audit-logger', () => ({
  logTeamAction: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/team/test',
    method: 'PATCH',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (
    c: {
      get: (key: string) => { orgRole?: string | null; role?: string | null }
      json: (body: unknown, status?: number) => Response
    },
    next: () => Promise<void>
  ) => {
    const user = c.get('user')
    if (user?.orgRole !== 'org:admin' && user?.role !== 'ADMIN') {
      return c.json({ error: 'Admin only' }, 403)
    }
    return next()
  },
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import type { AuthVariables } from '../../../middleware/auth'
import { teamRoute } from '../index'

type TestUser = ReturnType<typeof adminUser>

function createApp(user: TestUser) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/team', teamRoute)
  return app
}

function adminUser() {
  return {
    id: 'clerk_admin',
    staffId: 'staff_admin',
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

function managerUser() {
  return {
    ...adminUser(),
    id: 'clerk_manager',
    staffId: 'staff_manager',
    email: 'manager@test.com',
    name: 'Manager User',
    role: 'MANAGER',
    orgRole: 'org:member',
  }
}

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff_admin',
    role: 'ADMIN',
    name: 'Admin User',
    phoneNumber: '+15550000001',
    notifyOnUpload: false,
    notifyOnChat: false,
    notifyOnAgreementSigned: false,
    notifyOnClientPayment: false,
    ...overrides,
  }
}

function patchProfile(app: Hono<{ Variables: AuthVariables }>, staffId: string, body: object) {
  return app.request(`/team/members/${staffId}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /team/members/:staffId/profile — notify toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(staffRow() as never)
    vi.mocked(prisma.staff.update).mockResolvedValue(
      staffRow({ notifyOnAgreementSigned: true, notifyOnClientPayment: true }) as never
    )
  })

  it('lets an ADMIN update their own agreement/payment toggles', async () => {
    const res = await patchProfile(createApp(adminUser()), 'me', {
      notifyOnAgreementSigned: true,
      notifyOnClientPayment: true,
    })

    expect(res.status).toBe(200)
    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff_admin' },
        data: expect.objectContaining({
          notifyOnAgreementSigned: true,
          notifyOnClientPayment: true,
        }),
      })
    )
  })

  it('rejects a MANAGER setting the admin-only toggles on themselves', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(
      staffRow({ id: 'staff_manager', role: 'MANAGER', name: 'Manager User' }) as never
    )

    const res = await patchProfile(createApp(managerUser()), 'me', {
      notifyOnAgreementSigned: true,
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Agreement/payment notification toggles are admin-only',
    })
    expect(prisma.staff.update).not.toHaveBeenCalled()
  })

  it('rejects an ADMIN setting the toggles on a non-admin member', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(
      staffRow({ id: 'staff_member', role: 'STAFF', name: 'Member User' }) as never
    )

    const res = await patchProfile(createApp(adminUser()), 'staff_member', {
      notifyOnClientPayment: true,
    })

    expect(res.status).toBe(403)
    expect(prisma.staff.update).not.toHaveBeenCalled()
  })

  it('still lets a MANAGER update the role-agnostic notification toggles', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(
      staffRow({ id: 'staff_manager', role: 'MANAGER', name: 'Manager User' }) as never
    )
    vi.mocked(prisma.staff.update).mockResolvedValue(
      staffRow({ id: 'staff_manager', role: 'MANAGER', notifyOnUpload: true }) as never
    )

    const res = await patchProfile(createApp(managerUser()), 'me', {
      notifyOnUpload: true,
    })

    expect(res.status).toBe(200)
    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notifyOnUpload: true }),
      })
    )
  })
})
