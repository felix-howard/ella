/**
 * Tests for org-scope utility (Phase 4 - Client Filtering)
 * Verifies buildClientScopeFilter and buildNestedClientScope
 * produce correct Prisma where clauses per user role.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthUser } from '../../services/auth'

// Mock prisma before importing org-scope
vi.mock('../db', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
    },
  },
}))

import { buildClientScopeFilter, buildNestedClientScope, verifyClientAccess } from '../org-scope'
import { prisma } from '../db'

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'STAFF',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:member',
    ...overrides,
  }
}

describe('buildClientScopeFilter', () => {
  it('admin: filters by org only, no assignment filter', () => {
    const user = makeUser({ orgRole: 'org:admin' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({ organizationId: 'org_1' })
    expect(where).not.toHaveProperty('assignments')
  })

  it('member: filters by org + assignment', () => {
    const user = makeUser({ orgRole: 'org:member' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      organizationId: 'org_1',
      assignments: { some: { staffId: 'staff_1' } },
    })
  })

  it('null orgRole (non-admin): filters by org + assignment', () => {
    const user = makeUser({ orgRole: null })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      organizationId: 'org_1',
      assignments: { some: { staffId: 'staff_1' } },
    })
  })

  it('no org: still has assignment filter if staffId exists', () => {
    const user = makeUser({ organizationId: null, orgRole: null })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      assignments: { some: { staffId: 'staff_1' } },
    })
  })

  it('no org, no staffId: returns impossible filter (failsafe)', () => {
    const user = makeUser({ organizationId: null, orgRole: null, staffId: null })
    const where = buildClientScopeFilter(user)

    // Failsafe: prevents data leak by matching impossible ID
    expect(where).toEqual({ id: '__NO_ACCESS__' })
  })

  it('admin with no org: returns impossible filter (failsafe)', () => {
    const user = makeUser({ organizationId: null, orgRole: 'org:admin' })
    const where = buildClientScopeFilter(user)

    // Admin with no org: failsafe blocks access
    expect(where).toEqual({ id: '__NO_ACCESS__' })
  })
})

describe('buildNestedClientScope', () => {
  it('wraps client scope in client relation filter', () => {
    const user = makeUser({ orgRole: 'org:admin' })
    const where = buildNestedClientScope(user)

    expect(where).toEqual({
      client: { organizationId: 'org_1' },
    })
  })

  it('member: nested filter includes assignment scope', () => {
    const user = makeUser({ orgRole: 'org:member' })
    const where = buildNestedClientScope(user)

    expect(where).toEqual({
      client: {
        organizationId: 'org_1',
        assignments: { some: { staffId: 'staff_1' } },
      },
    })
  })

  it('returns failsafe nested when no scope applicable', () => {
    const user = makeUser({ organizationId: null, orgRole: null, staffId: null })
    const where = buildNestedClientScope(user)

    // Failsafe propagates into nested client filter
    expect(where).toEqual({ client: { id: '__NO_ACCESS__' } })
  })
})

describe('verifyClientAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when client found in scope', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({ id: 'client_1' } as never)

    const user = makeUser()
    const result = await verifyClientAccess('client_1', user)

    expect(result).toBe(true)
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'client_1',
        organizationId: 'org_1',
        assignments: { some: { staffId: 'staff_1' } },
      },
      select: { id: true },
    })
  })

  it('returns false when client not in scope', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null)

    const user = makeUser()
    const result = await verifyClientAccess('client_other', user)

    expect(result).toBe(false)
  })
})
