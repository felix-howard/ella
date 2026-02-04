/**
 * Team Routes Unit Tests
 * Tests team member listing, invitations, role changes, and deactivation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    clientAssignment: {
      findMany: vi.fn(),
    },
  },
}))

// Mock clerk client
vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      createOrganizationInvitation: vi.fn(),
      updateOrganizationMembership: vi.fn(),
      deleteOrganizationMembership: vi.fn(),
      getOrganizationInvitationList: vi.fn(),
      revokeOrganizationInvitation: vi.fn(),
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

// Mock auth middleware - pass through (user already set in test app)
vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { clerkClient } from '../../../lib/clerk-client'
import { deactivateStaff } from '../../../services/auth'
import type { AuthVariables } from '../../../middleware/auth'
import { teamRoute } from '../index'

// Helper: create test app with user context
function createApp(user = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/team', teamRoute)
  return app
}

function defaultUser() {
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

describe('Team Routes', () => {
  beforeEach(() => vi.clearAllMocks())

  // ============================================
  // GET /team/members
  // ============================================
  describe('GET /team/members', () => {
    it('returns active staff in org', async () => {
      const mockMembers = [
        { id: 's1', clerkId: 'c1', email: 'a@t.com', name: 'A', role: 'ADMIN', avatarUrl: null, lastLoginAt: null, _count: { clientAssignments: 3 } },
        { id: 's2', clerkId: 'c2', email: 'b@t.com', name: 'B', role: 'STAFF', avatarUrl: null, lastLoginAt: null, _count: { clientAssignments: 1 } },
      ]
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce(mockMembers as never)

      const app = createApp()
      const res = await app.request('/team/members')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_db_1', isActive: true },
        })
      )
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
        body: JSON.stringify({ emailAddress: 'new@test.com', role: 'org:member' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.invitation.emailAddress).toBe('new@test.com')
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
        body: JSON.stringify({ emailAddress: 'new@test.com' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Rate limited')
    })
  })

  // ============================================
  // PATCH /team/members/:staffId/role
  // ============================================
  describe('PATCH /team/members/:staffId/role', () => {
    it('updates role via Clerk', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true,
      } as never)
      vi.mocked(clerkClient.organizations.updateOrganizationMembership).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'org:admin' }),
      })

      expect(res.status).toBe(200)
      expect(vi.mocked(clerkClient.organizations.updateOrganizationMembership)).toHaveBeenCalledWith({
        organizationId: 'org_clerk_1',
        userId: 'c2',
        role: 'org:admin',
      })
    })

    it('returns 404 for staff not in org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/team/members/unknown/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'org:member' }),
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
        body: JSON.stringify({ role: 'org:member' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('last admin')
    })
  })

  // ============================================
  // DELETE /team/members/:staffId
  // ============================================
  describe('DELETE /team/members/:staffId', () => {
    it('deactivates staff and removes from Clerk org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({
        id: 's2', clerkId: 'c2', organizationId: 'org_db_1', isActive: true,
      } as never)
      vi.mocked(deactivateStaff).mockResolvedValueOnce({} as never)
      vi.mocked(clerkClient.organizations.deleteOrganizationMembership).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/team/members/s2', { method: 'DELETE' })

      expect(res.status).toBe(200)
      expect(vi.mocked(deactivateStaff)).toHaveBeenCalledWith('s2')
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
    })
  })

  // ============================================
  // GET /team/members/:staffId/assignments
  // ============================================
  describe('GET /team/members/:staffId/assignments', () => {
    it('returns assignments for staff in org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2', organizationId: 'org_db_1' } as never)
      vi.mocked(prisma.clientAssignment.findMany).mockResolvedValueOnce([
        { id: 'a1', staffId: 's2', clientId: 'c1', client: { id: 'c1', name: 'Client A', phone: '123' } },
      ] as never)

      const app = createApp()
      const res = await app.request('/team/members/s2/assignments')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
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
})
