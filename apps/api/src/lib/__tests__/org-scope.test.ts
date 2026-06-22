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

import {
  buildClientScopeFilter,
  buildNestedClientScope,
  verifyClientAccess,
  verifyBusinessClient,
  isAdminOrManager,
  isOrgAdmin,
  canSeeAllClients,
} from '../org-scope'
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

describe('isAdminOrManager / canSeeAllClients', () => {
  it('true for Clerk org:admin regardless of app role', () => {
    const user = makeUser({ orgRole: 'org:admin', role: 'STAFF' })
    expect(isAdminOrManager(user)).toBe(true)
    expect(canSeeAllClients(user)).toBe(true)
  })

  it('true for app-level ADMIN even when Clerk says org:member', () => {
    const user = makeUser({ orgRole: 'org:member', role: 'ADMIN' })
    expect(isAdminOrManager(user)).toBe(true)
    expect(canSeeAllClients(user)).toBe(true)
  })

  it('true for app-level MANAGER (Clerk stays org:member)', () => {
    const user = makeUser({ orgRole: 'org:member', role: 'MANAGER' })
    expect(isAdminOrManager(user)).toBe(true)
    expect(canSeeAllClients(user)).toBe(true)
  })

  it('false for STAFF and CPA', () => {
    expect(isAdminOrManager(makeUser({ role: 'STAFF' }))).toBe(false)
    expect(canSeeAllClients(makeUser({ role: 'STAFF' }))).toBe(false)
    expect(isAdminOrManager(makeUser({ role: 'CPA' }))).toBe(false)
    expect(canSeeAllClients(makeUser({ role: 'CPA' }))).toBe(false)
  })
})

describe('isOrgAdmin', () => {
  it('true for Clerk org:admin regardless of app role', () => {
    expect(isOrgAdmin(makeUser({ orgRole: 'org:admin', role: 'STAFF' }))).toBe(true)
  })

  it('true for app-level ADMIN even when Clerk says org:member', () => {
    expect(isOrgAdmin(makeUser({ orgRole: 'org:member', role: 'ADMIN' }))).toBe(true)
  })

  it('false for MANAGER and STAFF', () => {
    expect(isOrgAdmin(makeUser({ role: 'MANAGER' }))).toBe(false)
    expect(isOrgAdmin(makeUser({ role: 'STAFF' }))).toBe(false)
  })
})

describe('buildClientScopeFilter', () => {
  it('admin: filters by org only, no manager filter', () => {
    const user = makeUser({ orgRole: 'org:admin' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({ organizationId: 'org_1' })
    expect(where).not.toHaveProperty('managedById')
    expect(where).not.toHaveProperty('managers')
  })

  it('MANAGER: org-wide filter, no manager relation (sees all org clients)', () => {
    // MANAGER tier: Clerk role stays org:member; app role drives the scope
    const user = makeUser({ orgRole: 'org:member', role: 'MANAGER' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({ organizationId: 'org_1' })
    expect(where).not.toHaveProperty('managers')
  })

  it('MANAGER with no org: failsafe blocks access (no org-wide leak)', () => {
    const user = makeUser({ organizationId: null, orgRole: 'org:member', role: 'MANAGER' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({ id: '__NO_ACCESS__' })
  })

  it('app-level ADMIN with org:member Clerk role: org-wide filter', () => {
    const user = makeUser({ orgRole: 'org:member', role: 'ADMIN' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({ organizationId: 'org_1' })
  })

  it('CPA: filters by org + manager relation (assigned clients only)', () => {
    const user = makeUser({ orgRole: 'org:member', role: 'CPA' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      organizationId: 'org_1',
      managers: { some: { staffId: 'staff_1' } },
    })
  })

  it('member: filters by org + manager relation', () => {
    const user = makeUser({ orgRole: 'org:member' })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      organizationId: 'org_1',
      managers: { some: { staffId: 'staff_1' } },
    })
  })

  it('null orgRole (non-admin): filters by org + manager relation', () => {
    const user = makeUser({ orgRole: null })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      organizationId: 'org_1',
      managers: { some: { staffId: 'staff_1' } },
    })
  })

  it('no org: still has manager relation filter if staffId exists', () => {
    const user = makeUser({ organizationId: null, orgRole: null })
    const where = buildClientScopeFilter(user)

    expect(where).toEqual({
      managers: { some: { staffId: 'staff_1' } },
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

  it('non-admin with org but no staffId: returns impossible filter', () => {
    const user = makeUser({ orgRole: 'org:member', staffId: null })
    const where = buildClientScopeFilter(user)

    // Non-admin without staffId: blocked even with org
    expect(where).toEqual({
      organizationId: 'org_1',
      id: '__NO_ACCESS__',
    })
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

  it('member: nested filter includes manager relation scope', () => {
    const user = makeUser({ orgRole: 'org:member' })
    const where = buildNestedClientScope(user)

    expect(where).toEqual({
      client: {
        organizationId: 'org_1',
        managers: { some: { staffId: 'staff_1' } },
      },
    })
  })

  it('MANAGER: nested filter is org-wide, no manager relation', () => {
    const user = makeUser({ orgRole: 'org:member', role: 'MANAGER' })
    const where = buildNestedClientScope(user)

    expect(where).toEqual({ client: { organizationId: 'org_1' } })
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
        managers: { some: { staffId: 'staff_1' } },
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

describe('verifyBusinessClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns client when BUSINESS type found in scope', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({
      id: 'client_biz_1',
      clientType: 'BUSINESS',
    } as never)

    const user = makeUser()
    const result = await verifyBusinessClient('client_biz_1', user)

    expect(result).toEqual({ id: 'client_biz_1', clientType: 'BUSINESS' })
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'client_biz_1',
        clientType: 'BUSINESS',
        organizationId: 'org_1',
        managers: { some: { staffId: 'staff_1' } },
      },
      select: { id: true, clientType: true },
    })
  })

  it('returns null when client not found or not BUSINESS type', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null)

    const user = makeUser()
    const result = await verifyBusinessClient('client_indiv_1', user)

    expect(result).toBeNull()
  })

  it('enforces org scope for admin users', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue({
      id: 'client_biz_1',
      clientType: 'BUSINESS',
    } as never)

    const user = makeUser({ orgRole: 'org:admin' })
    await verifyBusinessClient('client_biz_1', user)

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'client_biz_1',
        clientType: 'BUSINESS',
        organizationId: 'org_1',
      },
      select: { id: true, clientType: true },
    })
  })
})
