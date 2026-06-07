/**
 * Staff role mapping - single source of truth for app-role <-> Clerk-role <-> Staff.role
 *
 * Clerk only has 'org:admin' | 'org:member'. App-level roles (ADMIN/MANAGER/MEMBER)
 * map to a Clerk role + a DB Staff.role. MANAGER stays 'org:member' in Clerk;
 * Staff.role in DB is the source of truth for app permissions.
 */
import type { StaffRole } from '@ella/db'

/** App-level roles accepted by team invite/role-change endpoints */
export const APP_ROLES = ['ADMIN', 'MANAGER', 'MEMBER'] as const
export type AppRole = (typeof APP_ROLES)[number]

export type ClerkOrgRole = 'org:admin' | 'org:member'

/** App role -> Clerk org role */
export const APP_ROLE_TO_CLERK_ROLE: Record<AppRole, ClerkOrgRole> = {
  ADMIN: 'org:admin',
  MANAGER: 'org:member',
  MEMBER: 'org:member',
}

/** App role -> DB Staff.role */
export const APP_ROLE_TO_STAFF_ROLE: Record<AppRole, StaffRole> = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'STAFF',
}

/** Staff roles that may be carried via Clerk invite/membership publicMetadata */
const METADATA_STAFF_ROLES: ReadonlySet<string> = new Set(['MANAGER', 'STAFF', 'CPA'])

/**
 * Resolve DB Staff.role from a Clerk membership without downgrading app-level roles.
 *
 * Preserve rule (prevents re-sync from overwriting MANAGER/CPA with STAFF):
 * - Clerk 'org:admin'  -> always ADMIN
 * - Clerk 'org:member' -> priority:
 *   1. intended role from membership/invitation publicMetadata.staffRole (invite-accept)
 *   2. demote to STAFF only if current role is ADMIN (admin demotion driven by Clerk)
 *   3. otherwise PRESERVE existing role (MANAGER/STAFF/CPA stay untouched)
 *   4. no existing record -> STAFF
 *
 * Caller contract for metadataStaffRole: only pass it on fresh-join events
 * (membership.created webhook, or login bootstrap with no DB record). Do NOT pass it
 * on repeated syncs (membership.updated, re-login) - invitation metadata can be stale
 * after an in-app role change, where the DB role is the source of truth.
 *
 * @param clerkRole Clerk org role ('org:admin' | 'org:member')
 * @param existingRole current Staff.role in DB, if a record exists
 * @param metadataStaffRole intended role from publicMetadata.staffRole (fresh joins only)
 */
export function resolveStaffRoleFromClerk(
  clerkRole: string | null | undefined,
  existingRole?: StaffRole | null,
  metadataStaffRole?: unknown
): StaffRole {
  if (clerkRole === 'org:admin') return 'ADMIN'

  // Invite-accept: explicit intended role wins (membership.created carries
  // the invitation's publicMetadata once accepted)
  if (typeof metadataStaffRole === 'string' && METADATA_STAFF_ROLES.has(metadataStaffRole)) {
    return metadataStaffRole as StaffRole
  }

  // Clerk-driven demotion: only ADMIN -> STAFF transitions come from Clerk
  if (existingRole === 'ADMIN') return 'STAFF'

  // Preserve app-level role on re-sync
  if (existingRole) return existingRole

  return 'STAFF'
}
