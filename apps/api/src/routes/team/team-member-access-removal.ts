import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { clerkFailureHttpStatus, describeClerkError, publicClerkError } from './team-clerk-errors'
import { type ClerkRemovalResult, removeClerkOrganizationMembershipIfPresent } from './team-clerk-membership-access'
import { activeAdminMutationGuard, clearAdminMutationReservation } from './team-admin-mutation-reservation'

type RemoveAccessCopy = { selfError: string; notFoundError: string }

type StaffAccessRecord = {
  id: string; clerkId: string | null; email: string; name: string; role: string; isActive: boolean
}

type RemoveAccessResult =
  | {
    success: true
    staff: StaffAccessRecord
    clerkRemovalResult: ClerkRemovalResult
  }
  | {
    success: false
    status: 400 | 404 | 429 | 500 | 502
    body: Record<string, unknown>
  }

type RemoveAccessReservation =
  | {
    success: true
    staff: StaffAccessRecord
    reservedAt: Date
  }
  | {
    success: false
    status: 400 | 404
    body: Record<string, unknown>
  }

export async function removeTeamMemberAccess(
  user: AuthVariables['user'],
  staffId: string,
  copy: RemoveAccessCopy
): Promise<RemoveAccessResult> {
  if (staffId === user.staffId) {
    return { success: false, status: 400, body: { error: copy.selfError } }
  }

  if (!user.organizationId) {
    return { success: false, status: 400, body: { error: 'Organization not found' } }
  }
  if (!user.clerkOrgId) {
    return { success: false, status: 400, body: { error: 'Organization not found' } }
  }
  const organizationId = user.organizationId

  const reservation = await prisma.$transaction(async (tx): Promise<RemoveAccessReservation> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-member-removal:${organizationId}`}))`

    const staff = await tx.staff.findFirst({
      where: { id: staffId, organizationId },
    })

    if (!staff) {
      return { success: false, status: 404, body: { error: copy.notFoundError } }
    }

    const reservedAt = new Date()
    if (staff.isActive && staff.role === 'ADMIN') {
      const adminCount = await tx.staff.count({
        where: activeAdminMutationGuard(organizationId),
      })
      if (adminCount <= 1) {
        return { success: false, status: 400, body: { error: 'Cannot deactivate the last admin' } }
      }

      await tx.staff.update({
        where: { id: staffId },
        data: { deactivatedAt: reservedAt },
      })
    }

    return { success: true, staff, reservedAt }
  })

  if (!reservation.success) return reservation

  const { staff, reservedAt } = reservation
  let clerkRemovalResult: ClerkRemovalResult = 'skipped_no_clerk_id'
  if (staff.clerkId || staff.email) {
    try {
      clerkRemovalResult = await removeClerkOrganizationMembershipIfPresent({
        organizationId: user.clerkOrgId,
        clerkUserId: staff.clerkId,
        emailAddress: staff.email,
      })
    } catch (error) {
      if (staff.isActive && staff.role === 'ADMIN') {
        await clearAdminMutationReservation(organizationId, staffId, reservedAt)
      }
      const clerkError = describeClerkError(error)
      console.error('[Team] Clerk membership removal failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return {
        success: false,
        status: clerkFailureHttpStatus(error),
        body: {
          error: 'CLERK_REMOVAL_FAILED',
          message: 'Could not remove Clerk access. Staff was not archived.',
          clerkError: publicClerkError(error),
        },
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-member-removal:${organizationId}`}))`
      await tx.staff.update({
        where: { id: staffId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
        },
      })
    })
  } catch (error) {
    console.error('[Team] Staff archive failed after Clerk access check:', {
      staffId,
      organizationId,
      clerkRemovalResult,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return {
      success: false,
      status: 500,
      body: {
        error: 'STAFF_ARCHIVE_INCOMPLETE',
        message: 'Clerk access may already be removed, but Staff was not archived. Retry remove access and check team reconciliation before inviting new members.',
        clerkRemovalResult,
      },
    }
  }

  return { success: true, staff, clerkRemovalResult }
}
