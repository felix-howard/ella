import { describe, expect, it } from 'vitest'
import type { TeamReconciliationMember } from '../api-client'
import {
  buildReconciliationByStaffId,
  canInviteAgain,
  hasClerkSeat,
  staffRoleToInviteRole,
} from '../team-reconciliation'

function row(
  status: TeamReconciliationMember['status'],
  overrides: Partial<TeamReconciliationMember> = {}
): TeamReconciliationMember {
  return {
    status,
    staffId: 'staff-1',
    clerkUserId: null,
    invitationId: null,
    email: 'member@test.com',
    name: 'Member',
    appRole: 'STAFF',
    clerkRole: null,
    isActive: true,
    managedClientCount: 0,
    ...overrides,
  }
}

describe('team reconciliation helpers', () => {
  it('keeps the highest-risk status when multiple rows reference one staff record', () => {
    const byStaffId = buildReconciliationByStaffId([
      row('ARCHIVED_MATCH', { isActive: false }),
      row('PENDING_INVITATION', { invitationId: 'inv-1', isActive: false }),
      row('ARCHIVED_STILL_IN_CLERK', { clerkUserId: 'clerk-1', isActive: false }),
    ])

    expect(byStaffId.get('staff-1')?.status).toBe('ARCHIVED_STILL_IN_CLERK')
  })

  it('maps Clerk seat and invite-again decisions from status', () => {
    expect(hasClerkSeat('ARCHIVED_STILL_IN_CLERK')).toBe(true)
    expect(hasClerkSeat('ARCHIVED_MATCH')).toBe(false)
    expect(canInviteAgain('ARCHIVED_STILL_IN_CLERK')).toBe(false)
    expect(canInviteAgain('PENDING_INVITATION')).toBe(false)
    expect(canInviteAgain('ARCHIVED_MATCH')).toBe(true)
  })

  it('maps Staff roles to safe invitation roles', () => {
    expect(staffRoleToInviteRole('ADMIN')).toBe('ADMIN')
    expect(staffRoleToInviteRole('MANAGER')).toBe('MANAGER')
    expect(staffRoleToInviteRole('CPA')).toBe('MEMBER')
    expect(staffRoleToInviteRole(null)).toBe('MEMBER')
  })
})
