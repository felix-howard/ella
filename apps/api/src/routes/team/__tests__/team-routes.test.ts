/**
 * Team Routes Unit Tests
 * Tests team member listing, invitations, role changes, and deactivation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => {
  const prisma = {
    staff: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationSubscription: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    client: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn((input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prisma) => unknown)(prisma)
        : Promise.resolve(input)
    ),
  }
  return { prisma }
})

// Mock storage service
vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateAvatarKey: vi.fn(),
  generateStaffFileKey: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  resolveAvatarUrl: vi.fn().mockImplementation((url: string | null) => Promise.resolve(url)),
}))

// Mock config
vi.mock('../../../lib/config', () => ({
  config: { workspaceUrl: 'http://localhost:5174' },
}))

// Mock clerk client
vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      createOrganizationInvitation: vi.fn(),
      updateOrganizationMembership: vi.fn(),
      getOrganizationMembershipList: vi.fn(),
      deleteOrganizationMembership: vi.fn(),
      getOrganizationInvitationList: vi.fn(),
      revokeOrganizationInvitation: vi.fn(),
    },
    users: {
      updateUser: vi.fn(),
    },
  },
}))

// Mock auth service
vi.mock('../../../services/auth', () => ({
  deactivateStaff: vi.fn(),
}))

// Mock audit logger
vi.mock('../../../services/audit-logger', () => ({
  logTeamAction: vi.fn(),
}))

// Mock activity logger
vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/team/test',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

// Mock auth middleware against the injected test user.
vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (c: { get: (key: string) => { orgRole?: string | null; role?: string | null }; json: (body: unknown, status?: number) => Response }, next: () => Promise<void>) => {
    const user = c.get('user')
    if (user?.orgRole !== 'org:admin' && user?.role !== 'ADMIN') {
      return c.json({ error: 'Chỉ admin mới có quyền' }, 403)
    }
    return next()
  },
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { clerkClient } from '../../../lib/clerk-client'
import { logTeamAction } from '../../../services/audit-logger'
import { logStaffActivity } from '../../../services/activity-log'
import { getSignedUploadUrl, generateAvatarKey, getSignedDownloadUrl } from '../../../services/storage'
import type { AuthVariables } from '../../../middleware/auth'
import { teamRoute } from '../index'

// Helper: create test app with user context
function createApp(user: AuthVariables['user'] = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/team', teamRoute)
  return app
}

function defaultUser(): AuthVariables['user'] {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'ADMIN',
    organizationId: 'org_db_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

function memberUser(): AuthVariables['user'] {
  return {
    id: 'clerk_user_2',
    staffId: 'staff_2',
    email: 'member@test.com',
    name: 'Member',
    role: 'STAFF',
    organizationId: 'org_db_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:member',
  }
}

function managerUser(): AuthVariables['user'] {
  return {
    id: 'clerk_user_3',
    staffId: 'staff_3',
    email: 'manager@test.com',
    name: 'Manager',
    role: 'MANAGER',
    organizationId: 'org_db_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:member',
  }
}

describe('Team Routes', () => {
  beforeEach(() => vi.clearAllMocks())

  // ============================================
  // GET /team/members
  // ============================================
  describe('GET /team/members', () => {
    it('returns active staff in org', async () => {
      const mockMembers = [
        {
          id: 's1',
          clerkId: 'c1',
          email: 'a@t.com',
          name: 'A',
          role: 'ADMIN',
          avatarUrl: null,
          lastLoginAt: null,
          isActive: true,
          isContractorAgent: false,
          formSlug: null,
          _count: { managedClientLinks: 3 },
        },
        {
          id: 's2',
          clerkId: 'c2',
          email: 'b@t.com',
          name: 'B',
          role: 'STAFF',
          avatarUrl: null,
          lastLoginAt: null,
          isActive: true,
          isContractorAgent: true,
          formSlug: null,
          _count: { managedClientLinks: 1 },
        },
      ]
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce(mockMembers as never)

      const app = createApp()
      const res = await app.request('/team/members')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data).toEqual([
        expect.objectContaining({ id: 's1', isContractorAgent: false, _count: { managedClients: 3 } }),
        expect.objectContaining({ id: 's2', isContractorAgent: true, _count: { managedClients: 1 } }),
      ])
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_db_1', isActive: true },
          select: expect.objectContaining({
            isContractorAgent: true,
            _count: { select: { managedClientLinks: true } },
          }),
        })
      )
    })

    it('allows admin to include archived staff', async () => {
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([] as never)

      const app = createApp()
      const res = await app.request('/team/members?includeArchived=true')

      expect(res.status).toBe(200)
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_db_1' },
        })
      )
    })

    it('returns only self for non-admin users and ignores archived query', async () => {
      const mockMembers = [
        {
          id: 'staff_3',
          clerkId: 'clerk_user_3',
          email: 'manager@test.com',
          name: 'Manager',
          role: 'MANAGER',
          avatarUrl: null,
          lastLoginAt: null,
          isActive: true,
          isContractorAgent: false,
          formSlug: null,
          _count: { managedClientLinks: 4 },
        },
      ]
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce(mockMembers as never)

      const app = createApp(managerUser())
      const res = await app.request('/team/members?includeArchived=true')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toEqual(expect.objectContaining({ id: 'staff_3' }))
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_db_1', id: 'staff_3', isActive: true },
        })
      )
    })

    it('returns 400 for non-admin list access without staff id', async () => {
      const app = createApp({ ...memberUser(), staffId: null })
      const res = await app.request('/team/members')

      expect(res.status).toBe(400)
      expect(vi.mocked(prisma.staff.findMany)).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // POST /team/invite
  // ============================================
  describe('POST /team/invite', () => {
    it('creates invitation via Clerk', async () => {
      vi.mocked(clerkClient.organizations.createOrganizationInvitation).mockResolvedValueOnce({
        id: 'inv_1',
        emailAddress: 'new@test.com',
        status: 'pending',
      } as never)

      const app = createApp()
      const res = await app.request('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: 'new@test.com', role: 'MEMBER' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.invitation.emailAddress).toBe('new@test.com')
      expect(vi.mocked(clerkClient.organizations.createOrganizationInvitation)).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'org:member',
          publicMetadata: { staffRole: 'STAFF' },
        })
      )
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_db_1',
          actorStaffId: 'staff_1',
          action: 'team.member_invited',
          metadata: expect.objectContaining({
            role: 'MEMBER',
          }),
        })
      )
    })

    it('rejects invalid email', async () => {
      const app = createApp()
      const res = await app.request('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: 'not-an-email' }),
      })

      expect(res.status).toBe(400)
    })

    it('handles Clerk API error', async () => {
      vi.mocked(clerkClient.organizations.createOrganizationInvitation).mockRejectedValueOnce(
        new Error('Rate limited')
      )

      const app = createApp()
      const res = await app.request('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: 'new@test.com', role: 'MEMBER' }),
      })

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toBe('CLERK_INVITE_FAILED')
      expect(body.message).toBe('Failed to send invitation.')
      expect(JSON.stringify(body)).not.toContain('Rate limited')
    })
  })

  // ============================================
  // PATCH /team/members/:staffId/role
  // ============================================
  describe('PATCH /team/members/:staffId/role', () => {
    it('updates role via Clerk', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.updateOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN' }),
      })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.updateOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
        role: 'org:admin',
      })
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: { role: 'ADMIN' },
      })
    })

    it('returns 404 for staff not in org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/team/members/unknown/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MEMBER' }),
      })

      expect(res.status).toBe(404)
    })

    it('prevents demoting last admin', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'ADMIN',
      } as never)
      vi.mocked(prisma.staff.count).mockResolvedValueOnce(1)

      const app = createApp()
      const res = await app.request('/team/members/s2/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MEMBER' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('last admin')
    })
  })

  // ============================================
  // PATCH /team/members/:staffId/contractor-agent
  // ============================================
  describe('PATCH /team/members/:staffId/contractor-agent', () => {
    it('toggles contractor agent flag and writes audit log', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2',
        organizationId: 'org_db_1',
        isActive: true,
        isContractorAgent: false,
      } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({
        id: 's2',
        isContractorAgent: true,
      } as never)

      const app = createApp()
      const res = await app.request('/team/members/s2/contractor-agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isContractorAgent: true }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.staff.isContractorAgent).toBe(true)
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's2' },
          data: { isContractorAgent: true },
        }),
      )
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_db_1',
          actorStaffId: 'staff_1',
          action: 'team.member_updated',
        })
      )
    })

    it('returns 404 for contractor agent toggle outside org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/team/members/unknown/contractor-agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isContractorAgent: true }),
      })

      expect(res.status).toBe(404)
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })

    it('forbids non-admin contractor agent toggle', async () => {
      const app = createApp(memberUser())
      const res = await app.request('/team/members/s2/contractor-agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isContractorAgent: true }),
      })

      expect(res.status).toBe(403)
      expect(vi.mocked(prisma.staff.findFirst)).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // DELETE /team/members/:staffId
  // ============================================
  describe('DELETE /team/members/:staffId', () => {
    it('deactivates staff and removes from Clerk org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'c2' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(prisma.$executeRaw).toHaveBeenCalled()
      expect(vi.mocked(clerkClient.organizations.getOrganizationMembershipList)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: ['c2'],
        limit: 1,
      })
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
      })
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      })
      expect(
        vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mock.invocationCallOrder[0]
      ).toBeLessThan(vi.mocked(prisma.staff.update).mock.invocationCallOrder[0])
    })

    it('fails closed and does not deactivate DB when Clerk removal fails', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'c2' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockRejectedValueOnce(
        new Error('Clerk unavailable')
      )

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toBe('CLERK_REMOVAL_FAILED')
      expect(JSON.stringify(body)).not.toContain('Clerk unavailable')
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
      })
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })

    it('reports partial removal if Staff archive fails after Clerk access is removed', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'c2' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockRejectedValueOnce(new Error('database unavailable'))

      try {
        const app = createApp()
        const res = await app.request('/team/members/s2', { method: 'DELETE' })
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toBe('STAFF_ARCHIVE_INCOMPLETE')
        expect(body.clerkRemovalResult).toBe('removed')
        expect(JSON.stringify(body)).not.toContain('database unavailable')
        expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
          organizationId: 'org_clerk_1',
          userId: 'c2',
        })
        expect(logStaffActivity).not.toHaveBeenCalled()
      } finally {
        consoleSpy.mockRestore()
      }
    })

    it('deactivates DB idempotently when Clerk membership is already missing', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [],
        totalCount: 0,
      } as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      })
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            clerkRemovalResult: 'already_removed',
          }),
        })
      )
    })

    it('removes Clerk access for an already archived Staff row', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: false, role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'c2' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
      })
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      })
    })

    it('removes Clerk access by email when archived Staff has no clerkId', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2',
        clerkId: null,
        email: 'archived@test.com',
        organizationId: 'org_db_1',
        isActive: false,
        role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'clerk_from_email' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.getOrganizationMembershipList)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        emailAddress: ['archived@test.com'],
        limit: 1,
      })
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'clerk_from_email',
      })
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      })
    })

    it('prevents deactivating the last active admin', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true, role: 'ADMIN',
      } as never)
      vi.mocked(prisma.staff.count).mockResolvedValueOnce(1)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('last admin')
      expect(vi.mocked(clerkClient.organizations.getOrganizationMembershipList)).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })

    it('fails before reservation when selected Clerk org is missing', async () => {
      const app = createApp({ ...defaultUser(), clerkOrgId: null })
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(400)
      expect(vi.mocked(prisma.staff.findFirst)).not.toHaveBeenCalled()
      expect(prisma.$executeRaw).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })

    it('prevents self-deactivation', async () => {
      const app = createApp()
      const res = await app.request('/team/members/staff_1', { method: 'DELETE' })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Cannot deactivate yourself')
    })

    it('returns 404 for staff not in org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/team/members/unknown', { method: 'DELETE' })

      expect(res.status).toBe(404)
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // GET /team/reconciliation
  // ============================================
  describe('GET /team/reconciliation', () => {
    it('forbids non-admin users', async () => {
      const app = createApp(memberUser())
      const res = await app.request('/team/reconciliation')

      expect(res.status).toBe(403)
      expect(vi.mocked(prisma.staff.findMany)).not.toHaveBeenCalled()
      expect(vi.mocked(clerkClient.organizations.getOrganizationMembershipList)).not.toHaveBeenCalled()
    })

    it('returns Staff and Clerk mismatch states with live seat count', async () => {
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
        {
          id: 'staff_active_match',
          clerkId: 'clerk_active',
          email: 'active@test.com',
          name: 'Active Match',
          role: 'ADMIN',
          isActive: true,
          _count: { managedClientLinks: 2 },
        },
        {
          id: 'staff_archived_still_in_clerk',
          clerkId: 'clerk_archived',
          email: 'archived@test.com',
          name: 'Archived Seat',
          role: 'STAFF',
          isActive: false,
          _count: { managedClientLinks: 1 },
        },
        {
          id: 'staff_archived_match',
          clerkId: 'clerk_removed',
          email: 'removed@test.com',
          name: 'Removed Member',
          role: 'STAFF',
          isActive: false,
          _count: { managedClientLinks: 0 },
        },
        {
          id: 'staff_active_missing',
          clerkId: 'clerk_missing',
          email: 'missing@test.com',
          name: 'Missing Clerk',
          role: 'MANAGER',
          isActive: true,
          _count: { managedClientLinks: 3 },
        },
      ] as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        totalCount: 3,
        data: [
          {
            id: 'mem_active',
            role: 'org:admin',
            publicUserData: {
              userId: 'clerk_active',
              identifier: 'active@test.com',
              firstName: 'Active',
              lastName: 'Match',
            },
          },
          {
            id: 'mem_archived',
            role: 'org:member',
            publicUserData: {
              userId: 'clerk_archived',
              identifier: 'archived@test.com',
              firstName: 'Archived',
              lastName: 'Seat',
            },
          },
          {
            id: 'mem_orphan',
            role: 'org:member',
            publicUserData: {
              userId: 'clerk_orphan',
              identifier: 'orphan@test.com',
              firstName: 'Orphan',
              lastName: 'Member',
            },
          },
        ],
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationInvitationList).mockResolvedValueOnce({
        totalCount: 1,
        data: [
          {
            id: 'inv_1',
            emailAddress: 'invited@test.com',
            role: 'org:member',
            status: 'pending',
          },
        ],
      } as never)

      const app = createApp()
      const res = await app.request('/team/reconciliation')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.seatsUsed).toBe(3)
      expect(body.pendingInvitationCount).toBe(1)
      expect(body.members).toEqual(expect.arrayContaining([
        expect.objectContaining({
          staffId: 'staff_active_match',
          status: 'ACTIVE_MATCH',
          managedClientCount: 2,
        }),
        expect.objectContaining({
          staffId: 'staff_archived_still_in_clerk',
          status: 'ARCHIVED_STILL_IN_CLERK',
        }),
        expect.objectContaining({
          staffId: 'staff_archived_match',
          status: 'ARCHIVED_MATCH',
        }),
        expect.objectContaining({
          staffId: 'staff_active_missing',
          status: 'ACTIVE_MISSING_CLERK',
        }),
        expect.objectContaining({
          clerkUserId: 'clerk_orphan',
          status: 'CLERK_MISSING_STAFF',
        }),
        expect.objectContaining({
          invitationId: 'inv_1',
          status: 'PENDING_INVITATION',
        }),
      ]))
      expect(clerkClient.organizations.getOrganizationMembershipList).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        limit: 100,
        offset: 0,
      })
      expect(clerkClient.organizations.getOrganizationInvitationList).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        status: ['pending'],
        limit: 100,
        offset: 0,
      })
    })
  })

  // ============================================
  // PATCH /team/members/:staffId/archive
  // ============================================
  describe('PATCH /team/members/:staffId/archive', () => {
    it('archives through the Clerk-first removal flow for backward compatibility', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2',
        clerkId: 'c2',
        email: 'member@test.com',
        organizationId: 'org_db_1',
        isActive: true,
        role: 'STAFF',
      } as never)
      vi.mocked(clerkClient.organizations.getOrganizationMembershipList).mockResolvedValueOnce({
        data: [{ id: 'mem_1', publicUserData: { userId: 'c2' } }],
        totalCount: 1,
      } as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2/archive', { method: 'PATCH' })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.deleteOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
      })
      expect(vi.mocked(prisma.staff.update)).toHaveBeenCalledWith({
        where: { id: 's2' },
        data: {
          isActive: false,
          deactivatedAt: expect.any(Date),
        },
      })
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_archived',
          metadata: expect.objectContaining({
            clerkRemovalResult: 'removed',
          }),
        })
      )
    })

    it('prevents self-archive', async () => {
      const app = createApp()
      const res = await app.request('/team/members/staff_1/archive', { method: 'PATCH' })

      expect(res.status).toBe(400)
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // PATCH /team/members/:staffId/unarchive
  // ============================================
  describe('PATCH /team/members/:staffId/unarchive', () => {
    it('rejects direct local restore and requires Clerk invitation flow', async () => {
      const app = createApp()
      const res = await app.request('/team/members/s2/unarchive', { method: 'PATCH' })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toBe('RESTORE_REQUIRES_INVITATION')
      expect(vi.mocked(prisma.staff.update)).not.toHaveBeenCalled()
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.member_unarchived',
          metadata: expect.objectContaining({
            result: 'denied',
            reason: 'restore_requires_clerk_invitation',
          }),
        })
      )
    })
  })

  // ============================================
  // GET /team/invitations
  // ============================================
  describe('GET /team/invitations', () => {
    it('returns Clerk org invitations', async () => {
      vi.mocked(clerkClient.organizations.getOrganizationInvitationList).mockResolvedValueOnce({
        data: [
          { id: 'inv_1', emailAddress: 'a@t.com', role: 'org:member', status: 'pending', createdAt: Date.now() },
        ],
      } as never)

      const app = createApp()
      const res = await app.request('/team/invitations')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })
  })

  // ============================================
  // DELETE /team/invitations/:invitationId
  // ============================================
  describe('DELETE /team/invitations/:invitationId', () => {
    it('revokes invitation via Clerk', async () => {
      vi.mocked(clerkClient.organizations.revokeOrganizationInvitation).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/invitations/inv_1', { method: 'DELETE' })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // ============================================
  // PUT /team/members/:staffId/notification-subscriptions
  // ============================================
  describe('PUT /team/members/:staffId/notification-subscriptions', () => {
    it('logs subscription updates with activity coalescing to avoid recent activity spam', async () => {
      vi.mocked(prisma.staff.count).mockResolvedValueOnce(2)
      vi.mocked(prisma.notificationSubscription.deleteMany).mockResolvedValueOnce({ count: 0 } as never)
      vi.mocked(prisma.notificationSubscription.createMany).mockResolvedValueOnce({ count: 2 } as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/notification-subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStaffIds: ['staff_3', 'staff_4'],
          type: 'CHAT',
        }),
      })

      expect(res.status).toBe(200)
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_db_1',
          actorStaffId: 'staff_1',
          action: 'team.notification_subscriptions_updated',
          coalesceKey: 'team.notification_subscriptions_updated:staff_2',
          coalesceWindowMs: 10 * 60 * 1000,
          metadata: expect.objectContaining({
            subscriptionType: 'CHAT',
            count: 2,
            editedSelf: false,
          }),
        })
      )
    })
  })

  // ============================================
  // Admin Edit Other Member Profiles
  // ============================================
  describe('Admin edit other member profiles', () => {
    const targetStaff = {
      id: 'staff_2', name: 'Member B', email: 'b@t.com', role: 'STAFF',
      avatarUrl: null, phoneNumber: '+84123456789', notifyOnUpload: false,
      notifyOnChat: false, title: null, formSlug: null, autoSendUploadLink: false,
      defaultUploadLinkTemplateId: null, deactivatedAt: null, isContractorAgent: true,
      organizationId: 'org_db_1', isActive: true, clerkId: 'c2',
      paymentInfos: [],
      _count: { managedClientLinks: 2 },
    }

    it('GET profile returns canEdit=true for admin viewing another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/profile')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.canEdit).toBe(true)
      expect(body.staff.isContractorAgent).toBe(true)
      expect(body.staff._count).toEqual({ managedClients: 2 })
      expect(body.managedCount).toBe(2)
      expect(body.staff.firstName).toBe('Member')
      expect(body.staff.lastName).toBe('B')
      expect(vi.mocked(prisma.staff.findFirst)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'staff_2',
            organizationId: 'org_db_1',
          },
          select: expect.objectContaining({
            isContractorAgent: true,
            _count: { select: { managedClientLinks: true } },
          }),
        })
      )
      expect(vi.mocked(prisma.client.findMany)).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_db_1',
          managers: { some: { staffId: 'staff_2' } },
        },
        select: { id: true, name: true, phone: true, avatarUrl: true },
        take: 50,
        orderBy: { name: 'asc' },
      })
    })

    it('GET profile returns 403 for non-admin viewing another member', async () => {
      const app = createApp(memberUser())
      // Member user (staff_2) trying to view another member's profile (staff_2 -> staff_2 is self, so use staff_1)
      const res = await app.request('/team/members/staff_1/profile')

      expect(res.status).toBe(403)
      expect(vi.mocked(prisma.staff.findFirst)).not.toHaveBeenCalled()
      expect(vi.mocked(prisma.client.findMany)).not.toHaveBeenCalled()
    })

    it('GET profile allows non-admin viewing self by me', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ ...targetStaff, id: 'staff_2' } as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

      const app = createApp(memberUser())
      const res = await app.request('/team/members/me/profile')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.canEdit).toBe(true)
      expect(body.staff.id).toBe('staff_2')
    })

    it('GET profile allows non-admin viewing self by staff id', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ ...targetStaff, id: 'staff_2' } as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

      const app = createApp(memberUser())
      const res = await app.request('/team/members/staff_2/profile')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.canEdit).toBe(true)
      expect(body.staff.id).toBe('staff_2')
    })

    it('PATCH profile allows admin to edit another member', async () => {
      const targetForPatch = {
        id: 'staff_2', name: 'Member B', email: 'b@t.com', role: 'STAFF',
        avatarUrl: null, phoneNumber: '+84123456789', notifyOnUpload: false,
        notifyOnChat: false, title: null, clerkId: 'c2', isActive: true,
      }
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetForPatch as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({
        id: 'staff_2', name: 'New Name', email: 'b@t.com',
        phoneNumber: '+84123456789', avatarUrl: null, notifyOnUpload: false, notifyOnChat: false, title: null,
      } as never)
      vi.mocked(clerkClient.users.updateUser).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'New', lastName: 'Name' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(logStaffActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_db_1',
          actorStaffId: 'staff_1',
          action: 'profile.updated',
        })
      )
    })

    it('PATCH profile returns 403 for non-admin editing another member', async () => {
      const app = createApp(memberUser())
      const res = await app.request('/team/members/staff_1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked' }),
      })

      expect(res.status).toBe(403)
    })

    it('POST avatar presigned-url allows admin for another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(generateAvatarKey).mockReturnValueOnce('avatars/staff_2/abc.jpg')
      vi.mocked(getSignedUploadUrl).mockResolvedValueOnce('https://r2.example.com/upload' as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/avatar/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', fileSize: 5000 }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.presignedUrl).toBe('https://r2.example.com/upload')
    })

    it('POST avatar presigned-url returns 403 for non-admin', async () => {
      const app = createApp(memberUser())
      const res = await app.request('/team/members/staff_1/avatar/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', fileSize: 5000 }),
      })

      expect(res.status).toBe(403)
    })

    it('PATCH avatar confirm allows admin for another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(getSignedDownloadUrl).mockResolvedValueOnce('https://r2.example.com/avatar.jpg' as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: 'avatars/staff_2/abc.jpg' }),
      })

      expect(res.status).toBe(200)
      expect(vi.mocked(logTeamAction)).toHaveBeenCalledWith(
        'AVATAR_UPDATED', 'staff_2', 'staff_1', expect.any(Object)
      )
    })

    it('PATCH avatar confirm returns 403 for non-admin', async () => {
      const app = createApp(memberUser())
      const res = await app.request('/team/members/staff_1/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: 'avatars/staff_1/abc.jpg' }),
      })

      expect(res.status).toBe(403)
    })
  })
})
