import type {
  AppRole,
  StaffAppRole,
  TeamMembershipStatus,
  TeamReconciliationMember,
} from './api-client'

const STATUS_PRIORITY: Record<TeamMembershipStatus, number> = {
  ARCHIVED_STILL_IN_CLERK: 50,
  ACTIVE_MISSING_CLERK: 40,
  PENDING_INVITATION: 30,
  ACTIVE_MATCH: 20,
  ARCHIVED_MATCH: 10,
  CLERK_MISSING_STAFF: 0,
}

export function buildReconciliationByStaffId(
  rows: TeamReconciliationMember[] | undefined
): Map<string, TeamReconciliationMember> {
  const byStaffId = new Map<string, TeamReconciliationMember>()
  for (const row of rows ?? []) {
    if (!row.staffId) continue

    const current = byStaffId.get(row.staffId)
    if (!current || STATUS_PRIORITY[row.status] > STATUS_PRIORITY[current.status]) {
      byStaffId.set(row.staffId, row)
    }
  }
  return byStaffId
}

export function hasClerkSeat(status: TeamMembershipStatus | undefined): boolean {
  return status === 'ACTIVE_MATCH' || status === 'ARCHIVED_STILL_IN_CLERK'
}

export function canInviteAgain(status: TeamMembershipStatus | undefined): boolean {
  return status === 'ARCHIVED_MATCH'
}

export function staffRoleToInviteRole(role: StaffAppRole | string | null | undefined): AppRole {
  if (role === 'ADMIN') return 'ADMIN'
  if (role === 'MANAGER') return 'MANAGER'
  return 'MEMBER'
}
