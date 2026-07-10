/**
 * MANAGER role route-level authorization tests (Phase 5 - MANAGER role plan)
 *
 * Verifies the permission matrix end-to-end through real route + middleware code:
 * - MANAGER: 200 on clients / admin-config / leads (org-wide scope)
 * - MANAGER: 403 on team mutations (invite / role change / deactivate)
 * - Phone privacy: raw response bodies contain NO unmasked phone for MANAGER/STAFF;
 *   ADMIN receives full phone numbers
 *
 * Only the auth CONTEXT is mocked (Clerk JWT parsing + DB rows). All role checks
 * (requireAdminOrManager, requireOrgAdmin, buildClientScopeFilter, serializePhone)
 * execute real code paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// --- Auth context mock: Clerk JWT parsing only ---
vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getAuth: vi.fn(),
}))

// --- DB mock: fixtures stand in for real rows; query-building code still runs ---
vi.mock('../../lib/db', () => ({
  prisma: {
    staff: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    organization: { upsert: vi.fn() },
    client: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    lead: { findMany: vi.fn(), count: vi.fn() },
    message: { findMany: vi.fn(), createMany: vi.fn() },
    smsSendLog: { findMany: vi.fn() },
    intakeQuestion: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

// --- Clerk backend client stub (imported by team route / auth service) ---
vi.mock('../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      getOrganizationMembershipList: vi.fn(),
      createOrganizationInvitation: vi.fn(),
      updateOrganizationMembership: vi.fn(),
    },
    users: { getUser: vi.fn() },
  },
}))

vi.mock('../../services/storage', () => ({
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
  getSignedUploadUrl: vi.fn(),
  generateAvatarKey: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  generateStaffFileKey: vi.fn(),
}))

import { getAuth } from '@hono/clerk-auth'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'
import { authMiddleware } from '../../middleware/auth'
import { clientsRoute } from '../clients'
import { adminRoute } from '../admin'
import { teamRoute } from '../team'
import { leadsRoute } from '../leads'
import { leadMessagesRoute } from '../leads/messages'
import { staffRoute } from '../staff'

// Test app mirrors app.ts mounting (leads applies authMiddleware inline)
const app = new Hono()
app.use('/clients/*', authMiddleware)
app.use('/admin/*', authMiddleware)
app.use('/team/*', authMiddleware)
app.use('/staff/*', authMiddleware)
app.route('/clients', clientsRoute)
app.route('/admin', adminRoute)
app.route('/team', teamRoute)
app.route('/staff', staffRoute)
app.route('/leads', leadsRoute)
app.route('/leads', leadMessagesRoute)

const FULL_PHONE = '+14155551234'
const SIBLING_PHONE = '+14155559876'
// Specific fixture numbers + any 7+ consecutive digit run (generic leak detector:
// masked phones, ISO dates, and cuids never produce 7+ consecutive digits)
const RAW_PHONE_DIGITS = /4155551234|4155559876|\d{7,}/
// Valid per clientIdParamSchema: /^c[a-z0-9]{24}$/
const CLIENT_ID = 'caaaaaaaaaaaaaaaaaaaaaaaa'

type Role = 'ADMIN' | 'MANAGER' | 'STAFF'

/** Configure auth context for a given role: Clerk JWT + Staff DB row */
function loginAs(role: Role) {
  const orgRole = role === 'ADMIN' ? 'org:admin' : 'org:member'
  vi.mocked(getAuth).mockReturnValue({
    userId: `user_${role.toLowerCase()}`,
    orgId: 'org_clerk_1',
    orgRole,
  } as never)
  vi.mocked(prisma.staff.findUnique).mockResolvedValue({
    id: `staff_${role.toLowerCase()}`,
    clerkId: `user_${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@test.com`,
    name: `${role} User`,
    role,
    avatarUrl: null,
    organizationId: 'org_1',
    isActive: true,
    organization: { id: 'org_1', clerkOrgId: 'org_clerk_1' },
  } as never)
}

function mockClientRow() {
  return {
    id: 'client_1',
    firstName: 'Linh',
    lastName: 'Nguyen',
    phone: FULL_PHONE,
    email: 'linh@test.com',
    language: 'VI',
    source: 'MANUAL',
    tags: [],
    clientType: 'INDIVIDUAL',
    clientGroupId: null,
    businessType: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    profile: null,
    managedBy: null,
    managers: [],
    createdBy: null,
    taxCases: [],
  }
}

/** Detail row for GET /clients/:id — includes a linked group sibling with its own phone */
function mockClientDetailRow() {
  return {
    ...mockClientRow(),
    id: CLIENT_ID,
    avatarUrl: null,
    profile: null,
    updatedBy: null,
    einEncrypted: null,
    clientGroup: {
      id: 'group_1',
      clients: [
        {
          id: 'cbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Linh LLC',
          clientType: 'BUSINESS',
          phone: SIBLING_PHONE,
          email: null,
          businessType: 'LLC',
          einEncrypted: null,
          taxCases: [],
        },
      ],
    },
    convertedLeads: [],
  }
}

function mockLeadRow() {
  return {
    id: 'lead_1',
    firstName: 'Bao',
    lastName: 'Tran',
    phone: FULL_PHONE,
    email: null,
    businessName: null,
    status: 'NEW',
    campaignTag: null,
    tags: [],
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    convertedToId: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.client.findMany).mockResolvedValue([mockClientRow()] as never)
  vi.mocked(prisma.client.count).mockResolvedValue(1 as never)
  vi.mocked(prisma.lead.findMany).mockResolvedValue([mockLeadRow()] as never)
  vi.mocked(prisma.lead.count).mockResolvedValue(1 as never)
  vi.mocked(prisma.smsSendLog.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.message.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.intakeQuestion.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never)
})

describe('MANAGER permission matrix (route integration)', () => {
  describe('Auth middleware inactive staff guard', () => {
    it('rejects inactive Staff in the selected org without Clerk bootstrap sync', async () => {
      vi.mocked(getAuth).mockReturnValue({
        userId: 'user_archived',
        orgId: 'org_clerk_1',
        orgRole: 'org:member',
      } as never)
      vi.mocked(prisma.staff.findUnique).mockResolvedValue({
        id: 'staff_archived',
        clerkId: 'user_archived',
        email: 'archived@test.com',
        name: 'Archived User',
        role: 'STAFF',
        avatarUrl: null,
        organizationId: 'org_1',
        isActive: false,
        organization: { id: 'org_1', clerkOrgId: 'org_clerk_1' },
      } as never)

      const res = await app.request('/team/members')

      expect(res.status).toBe(403)
      expect(clerkClient.organizations.getOrganizationMembershipList).not.toHaveBeenCalled()
      expect(prisma.staff.update).not.toHaveBeenCalled()
      expect(prisma.staff.upsert).not.toHaveBeenCalled()
    })
  })

  describe('MANAGER: near-admin access (200)', () => {
    beforeEach(() => loginAs('MANAGER'))

    it('GET /clients → 200 with org-wide scope (no managers filter)', async () => {
      const res = await app.request('/clients')
      expect(res.status).toBe(200)

      const findManyArgs = vi.mocked(prisma.client.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
      expect(findManyArgs.where).toEqual({ organizationId: 'org_1' })
      expect(findManyArgs.where).not.toHaveProperty('managers')
    })

    it('GET /admin/intake-questions (admin config) → 200', async () => {
      const res = await app.request('/admin/intake-questions')
      expect(res.status).toBe(200)
    })

    it('GET /leads → 200', async () => {
      const res = await app.request('/leads')
      expect(res.status).toBe(200)
    })

    it('GET /leads/messages/conversations → 200', async () => {
      const now = new Date('2026-04-24T10:00:00Z')
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ leadId: 'lead_1', lastMessageAt: now }] as never)
        .mockResolvedValueOnce([{ total: 1n }] as never)
        .mockResolvedValueOnce([{ leadId: 'lead_1', unreadCount: 1n }] as never)
        .mockResolvedValueOnce([{ totalUnread: 1n }] as never)
      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([
        {
          ...mockLeadRow(),
          messages: [{
            id: 'message_1',
            leadId: 'lead_1',
            direction: 'INBOUND',
            channel: 'SMS',
            content: 'hello',
            templateUsed: null,
            staffAuthoredContent: null,
            attachmentUrls: [],
            attachmentR2Keys: [],
            createdAt: now,
            updatedAt: now,
            sentBy: null,
          }],
        },
      ] as never)

      const res = await app.request('/leads/messages/conversations')
      const body = await res.json() as { conversations: Array<{ leadId: string }> }

      expect(res.status).toBe(200)
      expect(body.conversations[0]?.leadId).toBe('lead_1')
    })
  })

  describe('ADMIN: staff selection access (200)', () => {
    beforeEach(() => loginAs('ADMIN'))

    it('GET /staff/assignable → 200 with active org staff list', async () => {
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
        { id: 'staff_admin', name: 'Admin User', avatarUrl: null, formSlug: 'admin' },
      ] as never)

      const res = await app.request('/staff/assignable')
      const body = await res.json() as { data: Array<{ id: string; name: string }> }

      expect(res.status).toBe(200)
      expect(body.data).toEqual([
        expect.objectContaining({ id: 'staff_admin', name: 'Admin User' }),
      ])
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_1', isActive: true },
        })
      )
    })
  })

  describe('MANAGER: team management blocked (403)', () => {
    beforeEach(() => loginAs('MANAGER'))

    it('GET /team/members → 200 with self-only scope', async () => {
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
        {
          id: 'staff_manager',
          clerkId: 'user_manager',
          email: 'manager@test.com',
          name: 'MANAGER User',
          role: 'MANAGER',
          avatarUrl: null,
          lastLoginAt: null,
          isActive: true,
          isContractorAgent: false,
          formSlug: null,
          _count: { managedClientLinks: 0 },
        },
      ] as never)

      const res = await app.request('/team/members?includeArchived=true')
      const body = await res.json() as { data: Array<{ id: string }> }

      expect(res.status).toBe(200)
      expect(body.data).toEqual([expect.objectContaining({ id: 'staff_manager' })])
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_1', id: 'staff_manager', isActive: true },
        })
      )
    })

    it('GET /staff/assignable → 200 with active org staff list', async () => {
      vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
        { id: 'staff_admin', name: 'Admin User', avatarUrl: null, formSlug: 'admin' },
        { id: 'staff_manager', name: 'Manager User', avatarUrl: null, formSlug: 'manager' },
      ] as never)

      const res = await app.request('/staff/assignable')
      const body = await res.json() as { data: Array<{ id: string; name: string }> }

      expect(res.status).toBe(200)
      expect(body.data).toEqual([
        expect.objectContaining({ id: 'staff_admin', name: 'Admin User' }),
        expect.objectContaining({ id: 'staff_manager', name: 'Manager User' }),
      ])
      expect(vi.mocked(prisma.staff.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org_1', isActive: true },
        })
      )
    })

    it('POST /team/invite → 403', async () => {
      const res = await app.request('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: 'new@test.com', role: 'MEMBER' }),
      })
      expect(res.status).toBe(403)
    })

    it('PATCH /team/members/:staffId/role → 403', async () => {
      const res = await app.request('/team/members/staff_x/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN' }),
      })
      expect(res.status).toBe(403)
    })

    it('DELETE /team/members/:staffId (deactivate) → 403', async () => {
      const res = await app.request('/team/members/staff_x', { method: 'DELETE' })
      expect(res.status).toBe(403)
    })
  })

  describe('STAFF: admin-gated routes blocked (403)', () => {
    beforeEach(() => loginAs('STAFF'))

    it('GET /admin/intake-questions → 403', async () => {
      const res = await app.request('/admin/intake-questions')
      expect(res.status).toBe(403)
    })

    it('GET /leads → 403', async () => {
      const res = await app.request('/leads')
      expect(res.status).toBe(403)
    })

    it('GET /leads/messages/conversations → 403', async () => {
      const res = await app.request('/leads/messages/conversations')
      expect(res.status).toBe(403)
    })

    it('POST /team/invite → 403', async () => {
      const res = await app.request('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: 'new@test.com', role: 'MEMBER' }),
      })
      expect(res.status).toBe(403)
    })

    it('GET /clients → 200 scoped to assigned clients (managers filter)', async () => {
      const res = await app.request('/clients')
      expect(res.status).toBe(200)

      const findManyArgs = vi.mocked(prisma.client.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
      expect(findManyArgs.where).toEqual({
        organizationId: 'org_1',
        managers: { some: { staffId: 'staff_staff' } },
      })
    })

    it('GET /staff/assignable → 403', async () => {
      const res = await app.request('/staff/assignable')
      expect(res.status).toBe(403)
    })
  })

  describe('Phone privacy: server-enforced masking in raw response bodies', () => {
    it('MANAGER GET /clients: body has NO unmasked phone, masked format present', async () => {
      loginAs('MANAGER')
      const res = await app.request('/clients')
      const raw = await res.text()

      expect(res.status).toBe(200)
      expect(raw).not.toMatch(RAW_PHONE_DIGITS)
      expect(raw).toContain('*** *** 1234')
    })

    it('STAFF GET /clients: body has NO unmasked phone', async () => {
      loginAs('STAFF')
      const res = await app.request('/clients')
      const raw = await res.text()

      expect(res.status).toBe(200)
      expect(raw).not.toMatch(RAW_PHONE_DIGITS)
      expect(raw).toContain('*** *** 1234')
    })

    it('MANAGER GET /leads: body has NO unmasked phone', async () => {
      loginAs('MANAGER')
      const res = await app.request('/leads')
      const raw = await res.text()

      expect(res.status).toBe(200)
      expect(raw).not.toMatch(RAW_PHONE_DIGITS)
      expect(raw).toContain('*** *** 1234')
    })

    it('MANAGER GET /clients/:id: own + group sibling phones masked in raw body', async () => {
      loginAs('MANAGER')
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClientDetailRow() as never)
      const res = await app.request(`/clients/${CLIENT_ID}`)
      const raw = await res.text()

      expect(res.status).toBe(200)
      expect(raw).not.toMatch(RAW_PHONE_DIGITS)
      expect(raw).toContain('*** *** 1234') // own phone
      expect(raw).toContain('*** *** 9876') // sibling phone (clients/index.ts sibling serialization)
    })

    it('STAFF GET /clients/:id: own + group sibling phones masked in raw body', async () => {
      loginAs('STAFF')
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClientDetailRow() as never)
      const res = await app.request(`/clients/${CLIENT_ID}`)
      const raw = await res.text()

      expect(res.status).toBe(200)
      expect(raw).not.toMatch(RAW_PHONE_DIGITS)
    })

    it('ADMIN GET /clients/:id: full phone for client and group sibling', async () => {
      loginAs('ADMIN')
      vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClientDetailRow() as never)
      const res = await app.request(`/clients/${CLIENT_ID}`)
      const body = await res.json() as { phone: string; clientGroup: { clients: Array<{ phone: string }> } }

      expect(res.status).toBe(200)
      expect(body.phone).toBe(FULL_PHONE)
      expect(body.clientGroup.clients[0].phone).toBe(SIBLING_PHONE)
    })

    it('ADMIN GET /clients: body contains the full phone number', async () => {
      loginAs('ADMIN')
      const res = await app.request('/clients')
      const body = await res.json() as { data: Array<{ phone: string }> }

      expect(res.status).toBe(200)
      expect(body.data[0].phone).toBe(FULL_PHONE)
    })

    it('ADMIN GET /leads: body contains the full phone number', async () => {
      loginAs('ADMIN')
      const res = await app.request('/leads')
      const body = await res.json() as { data: Array<{ phone: string }> }

      expect(res.status).toBe(200)
      expect(body.data[0].phone).toBe(FULL_PHONE)
    })
  })
})
