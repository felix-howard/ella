/**
 * Integration tests for /agreement-templates routes — schema validation,
 * org-admin gate on mutations, response envelope shape, and end-to-end
 * org-scoped CRUD via the service layer (db mocked).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    agreementTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

// Per-test override of the auth user role lets us hit both happy + 403 paths
// without redefining the mock between tests.
const { authState } = vi.hoisted(() => ({
  authState: {
    user: {
      id: 'clerk-1',
      staffId: 'staff-1',
      organizationId: 'org-1',
      role: 'ORG_ADMIN' as 'ORG_ADMIN' | 'STAFF',
    } as any,
  },
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    c.set('user', authState.user)
    await next()
  }
  const requireOrgAdmin = async (c: any, next: () => Promise<void>) => {
    if (authState.user?.role !== 'ORG_ADMIN') {
      return c.json({ success: false, error: 'Forbidden' }, 403)
    }
    return next()
  }
  return { authMiddleware, requireOrgAdmin, requireAdminOrManager: requireOrgAdmin, clerkMiddleware: authMiddleware }
})

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { agreementTemplatesRoute } from '../index'

const mockCreate = vi.mocked(prisma.agreementTemplate.create)
const mockFindFirst = vi.mocked(prisma.agreementTemplate.findFirst)
const mockFindMany = vi.mocked(prisma.agreementTemplate.findMany)
const mockFindUnique = vi.mocked(prisma.agreementTemplate.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreementTemplate.updateMany)

const app = new Hono()
app.route('/agreement-templates', agreementTemplatesRoute)

function tplRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    organizationId: 'org-1',
    createdByUserId: 'staff-1',
    name: 'Standard EL',
    type: 'ENGAGEMENT_LETTER',
    contentHtml: '<p>EL</p>',
    defaultDepositAmount: null,
    isArchived: false,
    createdAt: new Date('2026-04-25T00:00:00Z'),
    updatedAt: new Date('2026-04-25T00:00:00Z'),
    ...overrides,
  }
}

function jsonReq(method: string, body: unknown) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

describe('Agreement template routes', () => {
  beforeEach(() => {
    // mockReset (not just clearAllMocks) drains queued mockResolvedValueOnce
    // values so a 400/403-short-circuited test doesn't leak stale promises
    // into the next test.
    mockCreate.mockReset()
    mockFindFirst.mockReset()
    mockFindMany.mockReset()
    mockFindUnique.mockReset()
    mockUpdateMany.mockReset()
    authState.user = {
      id: 'clerk-1',
      staffId: 'staff-1',
      organizationId: 'org-1',
      role: 'ORG_ADMIN',
    }
  })

  describe('GET /agreement-templates', () => {
    it('returns org-scoped list with success envelope', async () => {
      mockFindMany.mockResolvedValueOnce([tplRow(), tplRow({ id: 'tpl-2' })] as any)

      const res = await app.request('/agreement-templates')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(2)
      const where = (mockFindMany.mock.calls[0][0] as any).where
      expect(where.organizationId).toBe('org-1')
      expect(where.isArchived).toBe(false)
    })

    it('passes type and includeArchived query params through', async () => {
      mockFindMany.mockResolvedValueOnce([] as any)

      await app.request('/agreement-templates?type=NDA&includeArchived=true')

      const where = (mockFindMany.mock.calls[0][0] as any).where
      expect(where.type).toBe('NDA')
      // includeArchived=true → isArchived filter omitted (or undefined).
      expect(where.isArchived).not.toBe(false)
    })

    it('rejects invalid type with 400', async () => {
      const res = await app.request('/agreement-templates?type=BOGUS')
      expect(res.status).toBe(400)
      expect(mockFindMany).not.toHaveBeenCalled()
    })

    it('reads are open to non-admin staff', async () => {
      authState.user.role = 'STAFF'
      mockFindMany.mockResolvedValueOnce([] as any)

      const res = await app.request('/agreement-templates')
      expect(res.status).toBe(200)
    })
  })

  describe('GET /agreement-templates/:id', () => {
    it('returns the template when org-scoped lookup succeeds', async () => {
      mockFindFirst.mockResolvedValueOnce(tplRow() as any)

      const res = await app.request('/agreement-templates/tpl-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.id).toBe('tpl-1')
    })

    it('returns 404 for cross-org template id', async () => {
      mockFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/agreement-templates/tpl-other-org')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /agreement-templates', () => {
    it('creates template (admin) with 201 + sanitized body', async () => {
      mockCreate.mockResolvedValueOnce(tplRow() as any)

      const res = await app.request(
        '/agreement-templates',
        jsonReq('POST', {
          name: 'Standard EL',
          type: 'ENGAGEMENT_LETTER',
          contentHtml: '<p>EL</p><script>x</script>',
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      const data = (mockCreate.mock.calls[0][0] as any).data
      expect(data.contentHtml).not.toContain('<script>')
      expect(data.organizationId).toBe('org-1')
    })

    it('rejects 403 when caller is not org-admin', async () => {
      authState.user.role = 'STAFF'

      const res = await app.request(
        '/agreement-templates',
        jsonReq('POST', {
          name: 'Sneaky',
          type: 'NDA',
          contentHtml: '<p>x</p>',
        }),
      )
      expect(res.status).toBe(403)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects extra fields (strict schema)', async () => {
      const res = await app.request(
        '/agreement-templates',
        jsonReq('POST', {
          name: 'EL',
          type: 'ENGAGEMENT_LETTER',
          contentHtml: '<p>x</p>',
          isArchived: true, // extra
        }),
      )
      expect(res.status).toBe(400)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects CUSTOM type at schema level', async () => {
      const res = await app.request(
        '/agreement-templates',
        jsonReq('POST', {
          name: 'Custom tpl',
          type: 'CUSTOM',
          contentHtml: '<p>x</p>',
        }),
      )
      expect(res.status).toBe(400)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects oversized defaultDepositAmount (Decimal(10,2))', async () => {
      const res = await app.request(
        '/agreement-templates',
        jsonReq('POST', {
          name: 'Big deposit',
          type: 'ENGAGEMENT_LETTER',
          contentHtml: '<p>x</p>',
          defaultDepositAmount: '999999999.99',
        }),
      )
      expect(res.status).toBe(400)
      // Confirms rejection happened at the schema layer (no DB call).
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /agreement-templates/:id', () => {
    it('updates name (admin)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tplRow({ name: 'Renamed' }) as any)

      const res = await app.request(
        '/agreement-templates/tpl-1',
        jsonReq('PATCH', { name: 'Renamed' }),
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.name).toBe('Renamed')
    })

    it('rejects empty body (refine: at least one field)', async () => {
      const res = await app.request(
        '/agreement-templates/tpl-1',
        jsonReq('PATCH', {}),
      )
      expect(res.status).toBe(400)
    })

    it('rejects type field even when wrapped in extra payload (immutable)', async () => {
      const res = await app.request(
        '/agreement-templates/tpl-1',
        jsonReq('PATCH', { type: 'NDA' }),
      )
      // .strict() rejects unknown keys → 400.
      expect(res.status).toBe(400)
    })

    it('returns 404 when row missing or cross-org', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      const res = await app.request(
        '/agreement-templates/tpl-x',
        // Name must satisfy schema min(3) so we reach the service layer
        // and exercise the count=0 → 404 path (not schema 400).
        jsonReq('PATCH', { name: 'New name' }),
      )
      expect(res.status).toBe(404)
    })

    it('rejects 403 when caller is not org-admin', async () => {
      authState.user.role = 'STAFF'

      const res = await app.request(
        '/agreement-templates/tpl-1',
        jsonReq('PATCH', { name: 'Renamed' }),
      )
      expect(res.status).toBe(403)
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('POST /agreement-templates/:id/archive + /unarchive', () => {
    it('archive flips isArchived=true (admin)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tplRow({ isArchived: true }) as any)

      const res = await app.request(
        '/agreement-templates/tpl-1/archive',
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      expect((mockUpdateMany.mock.calls[0][0] as any).data).toEqual({ isArchived: true })
    })

    it('unarchive flips isArchived=false (admin)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tplRow() as any)

      const res = await app.request(
        '/agreement-templates/tpl-1/unarchive',
        { method: 'POST' },
      )
      expect(res.status).toBe(200)
      expect((mockUpdateMany.mock.calls[0][0] as any).data).toEqual({ isArchived: false })
    })

    it('archive returns 403 for non-admin', async () => {
      authState.user.role = 'STAFF'
      const res = await app.request(
        '/agreement-templates/tpl-1/archive',
        { method: 'POST' },
      )
      expect(res.status).toBe(403)
    })

    it('archive returns 404 when cross-org', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      const res = await app.request(
        '/agreement-templates/tpl-other-org/archive',
        { method: 'POST' },
      )
      expect(res.status).toBe(404)
    })
  })
})
