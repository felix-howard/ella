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
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    client: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Mock storage service
vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateAvatarKey: vi.fn(),
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
import { logTeamAction } from '../../../services/audit-logger'
import { getSignedUploadUrl, generateAvatarKey, getSignedDownloadUrl } from '../../../services/storage'
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

function memberUser() {
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

describe('Team Routes', () => {
  beforeEach(() => vi.clearAllMocks())

  // ============================================
  // GET /team/members
  // ============================================
  describe('GET /team/members', () => {
    it('returns active staff in org', async () => {
      const mockMembers = [
        { id: 's1', clerkId: 'c1', email: 'a@t.com', name: 'A', role: 'ADMIN', avatarUrl: null, lastLoginAt: null, _count: { managedClients: 3 } },
        { id: 's2', clerkId: 'c2', email: 'b@t.com', name: 'B', role: 'STAFF', avatarUrl: null, lastLoginAt: null, _count: { managedClients: 1 } },
      ]
      vi.mocked(prisma.client.count).mockResolvedValueOnce(5)
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
  // Admin Edit Other Member Profiles
  // ============================================
  describe('Admin edit other member profiles', () => {
    const targetStaff = {
      id: 'staff_2', name: 'Member B', email: 'b@t.com', role: 'STAFF',
      avatarUrl: null, phoneNumber: '+84123456789', notifyOnUpload: false,
      organizationId: 'org_db_1', isActive: true, clerkId: 'c2',
      _count: { managedClients: 2 },
    }

    it('GET profile returns canEdit=true for admin viewing another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/profile')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.canEdit).toBe(true)
    })

    it('GET profile returns canEdit=false for non-admin viewing another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

      const app = createApp(memberUser())
      const res = await app.request('/team/members/staff_1/profile')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.canEdit).toBe(false)
    })

    it('PATCH profile allows admin to edit another member', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(targetStaff as never)
      vi.mocked(prisma.staff.update).mockResolvedValueOnce({
        id: 'staff_2', name: 'New Name', email: 'b@t.com',
        phoneNumber: '+84123456789', avatarUrl: null, notifyOnUpload: false,
      } as never)

      const app = createApp()
      const res = await app.request('/team/members/staff_2/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(vi.mocked(logTeamAction)).toHaveBeenCalledWith(
        'PROFILE_EDITED', 'staff_2', 'staff_1', expect.any(Object)
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
