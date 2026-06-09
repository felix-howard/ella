/**
 * Phone privacy unit tests (Phase 5 - MANAGER role plan)
 * Verifies server-enforced phone masking: full numbers visible ONLY to ADMIN
 * (Clerk org:admin or app-level Staff.role ADMIN); MANAGER/STAFF/CPA get masked.
 */
import { describe, it, expect } from 'vitest'
import type { AuthUser } from '../../services/auth'
import { canViewFullPhone, maskPhone, serializePhone } from '../phone-privacy'

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

describe('canViewFullPhone', () => {
  it('true for Clerk org:admin', () => {
    expect(canViewFullPhone(makeUser({ orgRole: 'org:admin', role: 'STAFF' }))).toBe(true)
  })

  it('true for app-level ADMIN with org:member Clerk role', () => {
    expect(canViewFullPhone(makeUser({ orgRole: 'org:member', role: 'ADMIN' }))).toBe(true)
  })

  it('false for MANAGER (key distinction from isAdminOrManager)', () => {
    expect(canViewFullPhone(makeUser({ role: 'MANAGER' }))).toBe(false)
  })

  it('false for STAFF and CPA', () => {
    expect(canViewFullPhone(makeUser({ role: 'STAFF' }))).toBe(false)
    expect(canViewFullPhone(makeUser({ role: 'CPA' }))).toBe(false)
  })

  it('false with null orgRole and non-admin app role', () => {
    expect(canViewFullPhone(makeUser({ orgRole: null, role: 'MANAGER' }))).toBe(false)
  })
})

describe('maskPhone', () => {
  it('keeps last 4 digits in "*** *** 1234" format', () => {
    expect(maskPhone('+14155551234')).toBe('*** *** 1234')
  })

  it('strips formatting before extracting last 4', () => {
    expect(maskPhone('(415) 555-9876')).toBe('*** *** 9876')
  })

  it('returns null for null/undefined/empty', () => {
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone(undefined)).toBeNull()
    expect(maskPhone('')).toBeNull()
  })

  it('short value (<4 digits): masks whatever digits exist', () => {
    expect(maskPhone('12')).toBe('*** *** 12')
  })

  it('value with no digits: masks to empty last-4', () => {
    expect(maskPhone('abc')).toBe('*** *** ')
  })
})

describe('serializePhone', () => {
  const FULL = '+14155551234'

  it('ADMIN (org:admin): returns full phone', () => {
    expect(serializePhone(makeUser({ orgRole: 'org:admin' }), FULL)).toBe(FULL)
  })

  it('app ADMIN (org:member): returns full phone', () => {
    expect(serializePhone(makeUser({ role: 'ADMIN' }), FULL)).toBe(FULL)
  })

  it('MANAGER: returns masked phone', () => {
    expect(serializePhone(makeUser({ role: 'MANAGER' }), FULL)).toBe('*** *** 1234')
  })

  it('STAFF: returns masked phone', () => {
    expect(serializePhone(makeUser({ role: 'STAFF' }), FULL)).toBe('*** *** 1234')
  })

  it('CPA: returns masked phone', () => {
    expect(serializePhone(makeUser({ role: 'CPA' }), FULL)).toBe('*** *** 1234')
  })

  it('null phone: returns null for any role', () => {
    expect(serializePhone(makeUser({ orgRole: 'org:admin' }), null)).toBeNull()
    expect(serializePhone(makeUser({ role: 'MANAGER' }), null)).toBeNull()
  })

  it('undefined phone: returns null (normalized)', () => {
    expect(serializePhone(makeUser({ orgRole: 'org:admin' }), undefined)).toBeNull()
    expect(serializePhone(makeUser({ role: 'STAFF' }), undefined)).toBeNull()
  })

  it('masked output never contains the raw number', () => {
    const masked = serializePhone(makeUser({ role: 'MANAGER' }), FULL)
    expect(masked).not.toContain('415555')
    expect(masked).toMatch(/^\*\*\* \*\*\* \d{4}$/)
  })
})
