/**
 * Staff Role Mapping Unit Tests
 * Tests app-role <-> Clerk-role <-> Staff.role mapping with preserve rule
 */
import { describe, it, expect } from 'vitest'
import {
  APP_ROLES,
  APP_ROLE_TO_CLERK_ROLE,
  APP_ROLE_TO_STAFF_ROLE,
  resolveStaffRoleFromClerk,
} from '../staff-role-mapping'

describe('Staff Role Mapping', () => {
  describe('Constants', () => {
    it('exports APP_ROLES with ADMIN, MANAGER, MEMBER', () => {
      expect(APP_ROLES).toEqual(['ADMIN', 'MANAGER', 'MEMBER'])
    })

    it('maps ADMIN to org:admin, MANAGER and MEMBER to org:member', () => {
      expect(APP_ROLE_TO_CLERK_ROLE).toEqual({
        ADMIN: 'org:admin',
        MANAGER: 'org:member',
        MEMBER: 'org:member',
      })
    })

    it('maps app roles to staff roles correctly', () => {
      expect(APP_ROLE_TO_STAFF_ROLE).toEqual({
        ADMIN: 'ADMIN',
        MANAGER: 'MANAGER',
        MEMBER: 'STAFF',
      })
    })
  })

  describe('resolveStaffRoleFromClerk', () => {
    // ========================================
    // Core rule: org:admin always -> ADMIN
    // ========================================
    it('resolves org:admin to ADMIN (always)', () => {
      expect(resolveStaffRoleFromClerk('org:admin')).toBe('ADMIN')
    })

    it('resolves org:admin to ADMIN even with existing MANAGER', () => {
      expect(resolveStaffRoleFromClerk('org:admin', 'MANAGER')).toBe('ADMIN')
    })

    it('resolves org:admin to ADMIN even with existing CPA', () => {
      expect(resolveStaffRoleFromClerk('org:admin', 'CPA')).toBe('ADMIN')
    })

    it('resolves org:admin to ADMIN even with existing STAFF', () => {
      expect(resolveStaffRoleFromClerk('org:admin', 'STAFF')).toBe('ADMIN')
    })

    // ========================================
    // Preserve rule: org:member
    // Priority 1: metadata (invite-accept) wins
    // ========================================
    it('uses metadata.staffRole=MANAGER when provided (invite-accept)', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, 'MANAGER')).toBe('MANAGER')
    })

    it('uses metadata.staffRole=STAFF when provided (invite-accept)', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, 'STAFF')).toBe('STAFF')
    })

    it('uses metadata.staffRole=CPA when provided (invite-accept)', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, 'CPA')).toBe('CPA')
    })

    it('uses metadata even when existing role differs (fresh join)', () => {
      // On membership.created (fresh join), metadata carries invite intent and wins
      expect(resolveStaffRoleFromClerk('org:member', 'STAFF', 'MANAGER')).toBe('MANAGER')
    })

    // ========================================
    // Preserve rule: org:member
    // Priority 2: demotion (ADMIN -> STAFF) from Clerk
    // ========================================
    it('demotes ADMIN to STAFF when Clerk role is org:member', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'ADMIN')).toBe('STAFF')
    })

    it('demotes ADMIN to STAFF even with null metadata', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'ADMIN', null)).toBe('STAFF')
    })

    it('demotes ADMIN to STAFF even with undefined metadata', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'ADMIN', undefined)).toBe('STAFF')
    })

    // ========================================
    // Preserve rule: org:member
    // Priority 3: preserve existing role
    // ========================================
    it('preserves MANAGER when org:member and no metadata (re-sync)', () => {
      // Critical regression case: MANAGER should not downgrade to STAFF
      expect(resolveStaffRoleFromClerk('org:member', 'MANAGER')).toBe('MANAGER')
    })

    it('preserves CPA when org:member and no metadata (re-sync)', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'CPA')).toBe('CPA')
    })

    it('preserves STAFF when org:member and no metadata (re-sync)', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'STAFF')).toBe('STAFF')
    })

    // ========================================
    // Preserve rule: org:member
    // Priority 4: no existing -> STAFF
    // ========================================
    it('defaults to STAFF when org:member and no existing role', () => {
      expect(resolveStaffRoleFromClerk('org:member')).toBe('STAFF')
    })

    it('defaults to STAFF when org:member, no existing, null metadata', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, null)).toBe('STAFF')
    })

    it('defaults to STAFF when org:member, no existing, undefined metadata', () => {
      expect(resolveStaffRoleFromClerk('org:member', undefined, undefined)).toBe('STAFF')
    })

    // ========================================
    // Metadata validation: invalid values ignored
    // ========================================
    it('ignores metadata with invalid value ADMIN', () => {
      // ADMIN not in allowed metadata set - should fall through to preserve/STAFF rule
      expect(resolveStaffRoleFromClerk('org:member', null, 'ADMIN')).toBe('STAFF')
    })

    it('ignores metadata with invalid value MEMBER', () => {
      // MEMBER not in allowed metadata set
      expect(resolveStaffRoleFromClerk('org:member', null, 'MEMBER')).toBe('STAFF')
    })

    it('ignores metadata with garbage value', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, 'INVALID_ROLE')).toBe('STAFF')
    })

    it('ignores metadata with empty string', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, '')).toBe('STAFF')
    })

    it('ignores metadata with number', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, 123 as unknown)).toBe('STAFF')
    })

    it('ignores metadata with object', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, { role: 'MANAGER' } as unknown)).toBe('STAFF')
    })

    it('ignores metadata with array', () => {
      expect(resolveStaffRoleFromClerk('org:member', null, ['MANAGER'] as unknown)).toBe('STAFF')
    })

    // ========================================
    // Edge cases: null/undefined Clerk role
    // ========================================
    it('treats null Clerk role as org:member (falls through to priority 3/4)', () => {
      expect(resolveStaffRoleFromClerk(null, 'MANAGER')).toBe('MANAGER')
    })

    it('treats undefined Clerk role as org:member (falls through to priority 3/4)', () => {
      expect(resolveStaffRoleFromClerk(undefined, 'STAFF')).toBe('STAFF')
    })

    it('treats null Clerk role with no existing as STAFF', () => {
      expect(resolveStaffRoleFromClerk(null)).toBe('STAFF')
    })

    // ========================================
    // Metadata type coercion: only string checked
    // ========================================
    it('preserves existing role when metadata is boolean true', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'MANAGER', true as unknown)).toBe('MANAGER')
    })

    it('preserves existing role when metadata is boolean false', () => {
      expect(resolveStaffRoleFromClerk('org:member', 'CPA', false as unknown)).toBe('CPA')
    })

    // ========================================
    // Metadata priority confirmation: invited with metadata MANAGER
    // but existing STAFF (edge: stale metadata after downgrade in-app)
    // When called with existing=STAFF and metadata='MANAGER',
    // should take metadata (fresh join)
    // ========================================
    it('uses metadata.staffRole even when existing is lower role (trust invite on fresh join)', () => {
      // membership.created carries intent; metadata wins on fresh joins
      expect(resolveStaffRoleFromClerk('org:member', 'STAFF', 'MANAGER')).toBe('MANAGER')
    })

    // ========================================
    // Re-sync scenarios (metadata must be undefined to preserve)
    // ========================================
    it('preserves MANAGER on re-sync (membership.updated, metadata undefined)', () => {
      // This is the membership.updated call pattern: existing MANAGER, no metadata
      expect(resolveStaffRoleFromClerk('org:member', 'MANAGER', undefined)).toBe('MANAGER')
    })

    it('preserves CPA on re-sync (metadata omitted)', () => {
      // Auth service re-login path: existing CPA, no metadata
      expect(resolveStaffRoleFromClerk('org:member', 'CPA')).toBe('CPA')
    })
  })
})
