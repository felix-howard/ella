/**
 * Lead list endpoint tests — CONVERTED filter behavior.
 *
 * Default behavior hides CONVERTED leads from the list. Tests pin:
 *   A) default call → where.status excludes CONVERTED.
 *   B) includeConverted=true → no status filter applied (returns all statuses).
 *   C) status=CONVERTED → only CONVERTED (override wins regardless of includeConverted).
 *   D) status=NEW → only NEW (no CONVERTED, regardless of includeConverted).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (s: string) => s,
  sanitizeTextInput: (s: string) => s,
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    if (!c.get('user')) {
      c.set('user', {
        id: 'clerk-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
        role: 'ORG_ADMIN',
        orgRole: 'org:admin',
        email: 't@t.com',
        name: 'Tester',
        clerkOrgId: 'clerk_org_1',
      })
    }
    await next()
  }
  const requireOrgAdmin = async (_c: any, next: () => Promise<void>) => next()
  return { authMiddleware, requireOrgAdmin, requireAdminOrManager: requireOrgAdmin }
})

import { Hono } from 'hono'
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/leads', leadsRoute)
  return app
}

beforeEach(() => {
  findManyMock.mockReset()
  findManyMock.mockResolvedValue([])
  countMock.mockReset()
  countMock.mockResolvedValue(0)
})

describe('GET /leads — CONVERTED filter', () => {
  it('A) default call excludes CONVERTED via where.status not equal', async () => {
    const res = await buildApp().request('/leads', { method: 'GET' })

    expect(res.status).toBe(200)
    expect(findManyMock).toHaveBeenCalledTimes(1)
    const where = findManyMock.mock.calls[0][0].where
    expect(where.organizationId).toBe('org_1')
    expect(where.status).toEqual({ not: 'CONVERTED' })
  })

  it('B) includeConverted=true omits status filter (returns all statuses)', async () => {
    const res = await buildApp().request('/leads?includeConverted=true', { method: 'GET' })

    expect(res.status).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect(where.organizationId).toBe('org_1')
    expect(where.status).toBeUndefined()
  })

  it('C) status=CONVERTED overrides and filters strictly to CONVERTED', async () => {
    const res = await buildApp().request('/leads?status=CONVERTED', { method: 'GET' })

    expect(res.status).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect(where.status).toBe('CONVERTED')
  })

  it('D) status=NEW filters strictly to NEW (no CONVERTED leak)', async () => {
    const res = await buildApp().request('/leads?status=NEW&includeConverted=true', { method: 'GET' })

    expect(res.status).toBe(200)
    const where = findManyMock.mock.calls[0][0].where
    expect(where.status).toBe('NEW')
  })
})
