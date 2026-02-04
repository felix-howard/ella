/**
 * Client Assignment Routes Unit Tests
 * Tests assignment CRUD: create, bulk, delete, list, transfer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
    },
    clientAssignment: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock auth middleware - pass through (user already set in test app)
vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import type { AuthVariables } from '../../../middleware/auth'
import { clientAssignmentsRoute } from '../index'

function createApp(user = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/client-assignments', clientAssignmentsRoute)
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

describe('Client Assignment Routes', () => {
  beforeEach(() => vi.clearAllMocks())

  // ============================================
  // POST /client-assignments
  // ============================================
  describe('POST /client-assignments', () => {
    it('creates assignment when both entities in org', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: 'c1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2' } as never)
      vi.mocked(prisma.clientAssignment.create).mockResolvedValueOnce({
        id: 'a1', clientId: 'c1', staffId: 's2',
        client: { id: 'c1', name: 'Client A', phone: '123' },
        staff: { id: 's2', name: 'Staff B', email: 'b@t.com' },
      } as never)

      const app = createApp()
      const res = await app.request('/client-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'c1', staffId: 's2' }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.clientId).toBe('c1')
    })

    it('returns 404 when client not in org', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2' } as never)

      const app = createApp()
      const res = await app.request('/client-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'bad_client', staffId: 's2' }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('Client not found')
    })

    it('returns 404 when staff not in org', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: 'c1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/client-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'c1', staffId: 'bad_staff' }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('Staff not found')
    })

    it('returns 409 for duplicate assignment', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: 'c1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2' } as never)
      vi.mocked(prisma.clientAssignment.create).mockRejectedValueOnce({ code: 'P2002' })

      const app = createApp()
      const res = await app.request('/client-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'c1', staffId: 's2' }),
      })

      expect(res.status).toBe(409)
    })
  })

  // ============================================
  // POST /client-assignments/bulk
  // ============================================
  describe('POST /client-assignments/bulk', () => {
    it('bulk creates assignments, skips duplicates', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2' } as never)
      vi.mocked(prisma.client.findMany).mockResolvedValueOnce([
        { id: 'c1' }, { id: 'c2' },
      ] as never)
      vi.mocked(prisma.clientAssignment.createMany).mockResolvedValueOnce({ count: 1 } as never)

      const app = createApp()
      const res = await app.request('/client-assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: ['c1', 'c2'], staffId: 's2' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.created).toBe(1)
      expect(body.data.skipped).toBe(1) // 2 valid - 1 created = 1 skipped
    })

    it('returns 404 when staff not in org', async () => {
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

      const app = createApp()
      const res = await app.request('/client-assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: ['c1'], staffId: 'bad_staff' }),
      })

      expect(res.status).toBe(404)
    })

    it('rejects empty clientIds array', async () => {
      const app = createApp()
      const res = await app.request('/client-assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [], staffId: 's2' }),
      })

      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // DELETE /client-assignments/:id
  // ============================================
  describe('DELETE /client-assignments/:id', () => {
    it('deletes assignment in org', async () => {
      vi.mocked(prisma.clientAssignment.findUnique).mockResolvedValueOnce({
        id: 'a1', client: { organizationId: 'org_db_1' },
      } as never)
      vi.mocked(prisma.clientAssignment.delete).mockResolvedValueOnce({} as never)

      const app = createApp()
      const res = await app.request('/client-assignments/a1', { method: 'DELETE' })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 404 for assignment in different org', async () => {
      vi.mocked(prisma.clientAssignment.findUnique).mockResolvedValueOnce({
        id: 'a1', client: { organizationId: 'other_org' },
      } as never)

      const app = createApp()
      const res = await app.request('/client-assignments/a1', { method: 'DELETE' })

      expect(res.status).toBe(404)
    })
  })

  // ============================================
  // GET /client-assignments
  // ============================================
  describe('GET /client-assignments', () => {
    it('lists assignments scoped to org', async () => {
      vi.mocked(prisma.clientAssignment.findMany).mockResolvedValueOnce([
        { id: 'a1', staff: { id: 's2', name: 'B', email: 'b@t.com' }, client: { id: 'c1', name: 'C1', phone: '1' } },
      ] as never)

      const app = createApp()
      const res = await app.request('/client-assignments')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('filters by staffId query param', async () => {
      vi.mocked(prisma.clientAssignment.findMany).mockResolvedValueOnce([] as never)

      const app = createApp()
      await app.request('/client-assignments?staffId=s2')

      expect(vi.mocked(prisma.clientAssignment.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ staffId: 's2' }),
        })
      )
    })
  })

  // ============================================
  // PUT /client-assignments/transfer
  // ============================================
  describe('PUT /client-assignments/transfer', () => {
    it('transfers client between staff in org', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: 'c1' } as never)
      // fromStaff
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's1' } as never)
      // toStaff
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's2' } as never)
      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{}, {}] as never)

      const app = createApp()
      const res = await app.request('/client-assignments/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'c1', fromStaffId: 's1', toStaffId: 's2' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 404 when target staff not in org', async () => {
      vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: 'c1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 's1' } as never)
      vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null) // toStaff not found

      const app = createApp()
      const res = await app.request('/client-assignments/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'c1', fromStaffId: 's1', toStaffId: 'bad' }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('Target staff')
    })
  })
})
