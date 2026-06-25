/**
 * Team management routes
 * Endpoints for org member listing, invitations, role changes, and deactivation
 * Uses Clerk Backend API for org membership operations
 */
import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel } from '@ella/db'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'
import { logTeamAction } from '../../services/audit-logger'
import { requireOrgAdmin, requireOrg } from '../../middleware/auth'
import { config } from '../../lib/config'
import type { AuthVariables } from '../../middleware/auth'
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateContractorAgentSchema,
  updateProfileSchema,
  updateNotificationSubscriptionsSchema,
  avatarPresignedUrlSchema,
  avatarConfirmSchema,
  staffPaymentCountryParamSchema,
  upsertStaffPaymentInfoBodySchema,
  upsertStaffPaymentInfoSchema,
} from './schemas'
import {
  getSignedUploadUrl,
  generateAvatarKey,
  resolveAvatarUrl,
} from '../../services/storage'
import { APP_ROLE_TO_CLERK_ROLE, APP_ROLE_TO_STAFF_ROLE } from '../../lib/staff-role-mapping'
import { serializePhone } from '../../lib/phone-privacy'
import { getAuditRequestContext, getChangedFieldNames, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'
import { staffFilesRoute } from './staff-files'
import { decryptSSN as decryptSensitiveValue, encryptSSN as encryptSensitiveValue } from '../../services/crypto'
import {
  clerkFailureHttpStatus,
  describeClerkError,
  publicClerkError,
} from './team-clerk-errors'
import {
  clearAdminMutationReservation,
  reserveAdminRoleDemotion,
} from './team-admin-mutation-reservation'
import { removeTeamMemberAccess } from './team-member-access-removal'
import {
  buildTeamReconciliation,
} from './team-membership-reconciliation'

const teamRoute = new Hono<{ Variables: AuthVariables }>()
const NOTIFICATION_SUBSCRIPTION_ACTIVITY_WINDOW_MS = 10 * 60 * 1000
type StaffPaymentCountryCode = 'US' | 'VN' | 'PH'

type StaffPaymentInfoSummaryRecord = {
  country: StaffPaymentCountryCode
  nameOnAccount: string
  bankName: string
  accountNumberEncrypted: string
  accountNumberLast4: string
  routingNumberEncrypted: string | null
  routingNumberLast4: string | null
  updatedAt: Date
}

/** Check if requester can edit target staff (self or org admin) */
function canEditStaff(user: { staffId: string | null; orgRole: string | null }, targetStaffId: string): boolean {
  return targetStaffId === user.staffId || isOrgAdmin(user)
}

function isOrgAdmin(user: { orgRole: string | null; role?: string | null }): boolean {
  return user.orgRole === 'org:admin' || user.role === 'ADMIN'
}

async function logTeamMemberActivity(
  c: Context<{ Variables: AuthVariables }>,
  user: AuthVariables['user'],
  targetStaffId: string,
  input: {
    summary: string
    action: string
    riskLevel?: ActivityRiskLevel
    coalesceKey?: string
    coalesceWindowMs?: number
    metadata?: Record<string, unknown>
  }
) {
  if (!user.staffId) return

  await logStaffActivity({
    organizationId: user.organizationId,
    actorStaffId: user.staffId,
    category: ACTIVITY_CATEGORIES.TEAM,
    targetType: ACTIVITY_TARGET_TYPES.STAFF,
    targetId: targetStaffId,
    summary: input.summary,
    action: input.action,
    riskLevel: input.riskLevel ?? ActivityRiskLevel.LOW,
    coalesceKey: input.coalesceKey,
    coalesceWindowMs: input.coalesceWindowMs,
    metadata: input.metadata,
    request: getAuditRequestContext(c),
  })
}

function serializeStaffPaymentInfo(info: StaffPaymentInfoSummaryRecord) {
  return {
    country: info.country,
    nameOnAccount: info.nameOnAccount,
    bankName: info.bankName,
    accountNumber: decryptSensitiveValue(info.accountNumberEncrypted),
    accountNumberLast4: info.accountNumberLast4,
    routingNumber: info.routingNumberEncrypted ? decryptSensitiveValue(info.routingNumberEncrypted) : null,
    routingNumberLast4: info.routingNumberLast4,
    updatedAt: info.updatedAt.toISOString(),
  }
}

function last4(value: string): string {
  return value.slice(-4)
}

// All team routes require active org
teamRoute.use('*', requireOrg)
teamRoute.route('/', staffFilesRoute)

// GET /team/members - List active staff in current org
teamRoute.get('/members', async (c) => {
  const user = c.get('user')
  const includeArchived = c.req.query('includeArchived') === 'true'
  const isAdmin = isOrgAdmin(user)

  if (!isAdmin && !user.staffId) {
    return c.json({ error: 'Staff ID required' }, 400)
  }

  const visibilityFilter = isAdmin
    ? includeArchived ? {} : { isActive: true }
    : { id: user.staffId!, isActive: true }

  const members = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      ...visibilityFilter,
    },
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      lastLoginAt: true,
      isActive: true,
      isContractorAgent: true,
      formSlug: true,
      _count: { select: { managedClientLinks: true } },
    },
    orderBy: { name: 'asc' },
  })

  // Always show actual managed client count (based on managedById relationship)
  const data = await Promise.all(
    members.map(async (m) => ({
      ...m,
      _count: { managedClients: m._count.managedClientLinks },
      avatarUrl: await resolveAvatarUrl(m.avatarUrl),
    }))
  )

  return c.json({ data })
})

// POST /team/invite - Send org invitation via Clerk (admin only)
teamRoute.post(
  '/invite',
  requireOrgAdmin,
  zValidator('json', inviteMemberSchema),
  async (c) => {
    const user = c.get('user')
    const { emailAddress, role } = c.req.valid('json')

    if (!user.organizationId || !user.clerkOrgId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    try {
      // MANAGER is org:member in Clerk; intended Staff.role travels via invitation
      // publicMetadata so the membership.created webhook assigns it on accept
      const invitation = await clerkClient.organizations.createOrganizationInvitation({
        organizationId: user.clerkOrgId,
        emailAddress,
        role: APP_ROLE_TO_CLERK_ROLE[role],
        inviterUserId: user.id,
        redirectUrl: `${config.workspaceUrl}/accept-invitation`,
        publicMetadata: { staffRole: APP_ROLE_TO_STAFF_ROLE[role] },
      })

      if (user.staffId) {
        await logStaffActivity({
          organizationId: user.organizationId,
          actorStaffId: user.staffId,
          category: ACTIVITY_CATEGORIES.TEAM,
          targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
          targetId: user.organizationId,
          summary: 'Invited team member',
          action: ACTIVITY_ACTIONS.TEAM.MEMBER_INVITED,
          riskLevel: ActivityRiskLevel.MEDIUM,
          metadata: {
            role,
            invitationId: invitation.id,
            status: invitation.status,
          },
          request: getAuditRequestContext(c),
        })
      }

      return c.json({
        success: true,
        invitation: {
          id: invitation.id,
          emailAddress: invitation.emailAddress,
          status: invitation.status,
        },
      })
    } catch (error: unknown) {
      const clerkError = describeClerkError(error)
      console.error('[Team] Invite failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return c.json({
        error: 'CLERK_INVITE_FAILED',
        message: 'Failed to send invitation.',
        clerkError: publicClerkError(error),
      }, clerkFailureHttpStatus(error))
    }
  }
)

// PATCH /team/members/:staffId/role - Update member role via Clerk (admin only)
// Note: Clerk role change triggers organizationMembership.updated webhook
// which syncs Staff.role in DB automatically
teamRoute.patch(
  '/members/:staffId/role',
  requireOrgAdmin,
  zValidator('json', updateMemberRoleSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const { role } = c.req.valid('json')

    if (!user.organizationId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    const reservation = await reserveAdminRoleDemotion({
      organizationId: user.organizationId,
      staffId,
    })
    if (!reservation.success) {
      return c.json(reservation.body, reservation.status)
    }

    const { staff, reservedAt } = reservation
    if (!staff.clerkId || !user.clerkOrgId) {
      if (staff.role === 'ADMIN') {
        await clearAdminMutationReservation(user.organizationId, staffId, reservedAt)
      }
      return c.json({ error: 'Cannot update role: missing Clerk link' }, 400)
    }

    const oldRole = staff.role
    try {
      await clerkClient.organizations.updateOrganizationMembership({
        organizationId: user.clerkOrgId,
        userId: staff.clerkId,
        role: APP_ROLE_TO_CLERK_ROLE[role],
      })
    } catch (error: unknown) {
      if (staff.role === 'ADMIN') {
        await clearAdminMutationReservation(user.organizationId, staffId, reservedAt)
      }
      const clerkError = describeClerkError(error)
      console.error('[Team] Role update failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return c.json({
        error: 'CLERK_ROLE_UPDATE_FAILED',
        message: 'Failed to update team member role.',
        clerkError: publicClerkError(error),
      }, clerkFailureHttpStatus(error))
    }

    // Sync role to DB immediately (don't wait for webhook). The membership.updated
    // webhook preserve rule never downgrades MANAGER/CPA, so this write is durable.
    // Known tiny race (ADMIN->MANAGER): if the webhook reads the old ADMIN role before
    // this write commits but applies its STAFF demotion after it, MANAGER could be lost.
    // Window is ms-scale; admin can re-apply. Revisit if it ever surfaces in practice.
    const dbRole = APP_ROLE_TO_STAFF_ROLE[role]
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-member-removal:${user.organizationId}`}))`
      await tx.staff.update({
        where: { id: staffId },
        data: {
          role: dbRole,
          ...(oldRole === 'ADMIN' && { deactivatedAt: null }),
        },
      })
    })

    // Audit log (async, non-blocking)
    logTeamAction('ROLE_CHANGED', staffId, user.staffId, { oldValue: oldRole, newValue: dbRole })
    await logTeamMemberActivity(c, user, staffId, {
      summary: 'Updated team member role',
      action: ACTIVITY_ACTIONS.TEAM.MEMBER_UPDATED,
      riskLevel: ActivityRiskLevel.HIGH,
      metadata: {
        changedFields: ['role'],
        previousRole: oldRole,
        newRole: dbRole,
      },
    })

    return c.json({ success: true })
  }
)

// PATCH /team/members/:staffId/contractor-agent - Toggle Contractor Agent flag (admin only)
teamRoute.patch(
  '/members/:staffId/contractor-agent',
  requireOrgAdmin,
  zValidator('json', updateContractorAgentSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const { isContractorAgent } = c.req.valid('json')

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: true },
      select: { id: true, isContractorAgent: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data: { isContractorAgent },
      select: { id: true, isContractorAgent: true },
    })

    logTeamAction('CONTRACTOR_AGENT_CHANGED', staffId, user.staffId, {
      oldValue: { isContractorAgent: staff.isContractorAgent },
      newValue: { isContractorAgent },
    })
    await logTeamMemberActivity(c, user, staffId, {
      summary: 'Updated contractor agent access',
      action: ACTIVITY_ACTIONS.TEAM.MEMBER_UPDATED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        changedFields: ['isContractorAgent'],
        isContractorAgent,
      },
    })

    return c.json({ success: true, staff: updated })
  }
)

// DELETE /team/members/:staffId - Remove Clerk access then archive Staff (admin only)
teamRoute.delete(
  '/members/:staffId',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    const removal = await removeTeamMemberAccess(user, staffId, {
      selfError: 'Cannot deactivate yourself',
      notFoundError: 'Staff not found',
    })
    if (!removal.success) {
      return c.json(removal.body, removal.status)
    }

    const { staff, clerkRemovalResult } = removal

    // Audit log (async, non-blocking)
    logTeamAction('STAFF_DEACTIVATED', staffId, user.staffId, {
      oldValue: { name: staff.name, email: staff.email },
      newValue: { isActive: false },
    })
    await logTeamMemberActivity(c, user, staffId, {
      summary: 'Deactivated team member',
      action: ACTIVITY_ACTIONS.TEAM.MEMBER_DEACTIVATED,
      riskLevel: ActivityRiskLevel.HIGH,
      metadata: {
        changedFields: ['isActive', 'deactivatedAt'],
        previousRole: staff.role,
        hadClerkMembership: Boolean(staff.clerkId),
        clerkRemovalResult,
      },
    })

    return c.json({ success: true })
  }
)

// GET /team/reconciliation - Compare Staff rows to live Clerk org membership
teamRoute.get(
  '/reconciliation',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')

    if (!user.organizationId || !user.clerkOrgId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    try {
      return c.json(await buildTeamReconciliation({
        organizationId: user.organizationId,
        clerkOrgId: user.clerkOrgId,
      }))
    } catch (error) {
      const clerkError = describeClerkError(error)
      console.error('[Team] Reconciliation failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return c.json({
        error: 'TEAM_RECONCILIATION_FAILED',
        message: 'Failed to fetch team reconciliation.',
        clerkError: publicClerkError(error),
      }, clerkFailureHttpStatus(error))
    }
  }
)

// PATCH /team/members/:staffId/archive - Legacy alias for Clerk-first access removal.
teamRoute.patch(
  '/members/:staffId/archive',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    const removal = await removeTeamMemberAccess(user, staffId, {
      selfError: 'Cannot archive yourself',
      notFoundError: 'Staff not found',
    })
    if (!removal.success) {
      return c.json(removal.body, removal.status)
    }

    const { clerkRemovalResult } = removal

    logTeamAction('STAFF_ARCHIVED', staffId, user.staffId, {
      oldValue: { isActive: true },
      newValue: { isActive: false, deactivatedAt: new Date().toISOString() },
    })
    await logTeamMemberActivity(c, user, staffId, {
      summary: 'Archived team member',
      action: ACTIVITY_ACTIONS.TEAM.MEMBER_ARCHIVED,
      riskLevel: ActivityRiskLevel.HIGH,
      metadata: {
        changedFields: ['isActive', 'deactivatedAt'],
        clerkRemovalResult,
      },
    })

    return c.json({ success: true })
  }
)

// PATCH /team/members/:staffId/unarchive - Direct local restore is no longer safe.
// Restore access through a Clerk invitation so Staff state follows membership state.
teamRoute.patch(
  '/members/:staffId/unarchive',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    if (user.staffId) {
      await logTeamMemberActivity(c, user, staffId, {
        summary: 'Denied local team member restore',
        action: ACTIVITY_ACTIONS.TEAM.MEMBER_UNARCHIVED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          result: 'denied',
          reason: 'restore_requires_clerk_invitation',
        },
      })
    }

    return c.json({
      error: 'RESTORE_REQUIRES_INVITATION',
      message: 'Restore access by sending a Clerk invitation.',
    }, 409)
  }
)

// GET /team/invitations - List pending invitations (admin only)
teamRoute.get(
  '/invitations',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')

    if (!user.clerkOrgId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    try {
      const invitationList = await clerkClient.organizations.getOrganizationInvitationList({
        organizationId: user.clerkOrgId,
      })

      const data = invitationList.data.map((inv) => ({
        id: inv.id,
        emailAddress: inv.emailAddress,
        role: inv.role,
        // Intended Staff.role carried in invitation metadata (distinguishes MANAGER invites).
        // Fallback is for legacy invites created before staffRole metadata existed.
        staffRole:
          (inv.publicMetadata as Record<string, unknown> | null | undefined)?.staffRole ??
          (inv.role === 'org:admin' ? 'ADMIN' : 'STAFF'),
        status: inv.status,
        createdAt: inv.createdAt,
      }))

      return c.json({ data })
    } catch (error: unknown) {
      const clerkError = describeClerkError(error)
      console.error('[Team] Invitation list failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return c.json({
        error: 'CLERK_INVITATION_LIST_FAILED',
        message: 'Failed to fetch invitations.',
        clerkError: publicClerkError(error),
      }, clerkFailureHttpStatus(error))
    }
  }
)

// DELETE /team/invitations/:invitationId - Revoke invitation (admin only)
teamRoute.delete(
  '/invitations/:invitationId',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const invitationId = c.req.param('invitationId')

    if (!user.clerkOrgId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    try {
      await clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: user.clerkOrgId,
        invitationId,
        requestingUserId: user.id,
      })

      if (user.staffId) {
        await logStaffActivity({
          organizationId: user.organizationId,
          actorStaffId: user.staffId,
          category: ACTIVITY_CATEGORIES.TEAM,
          targetType: ACTIVITY_TARGET_TYPES.ORGANIZATION,
          targetId: user.organizationId,
          summary: 'Revoked team invitation',
          action: ACTIVITY_ACTIONS.TEAM.INVITATION_REVOKED,
          riskLevel: ActivityRiskLevel.MEDIUM,
          metadata: { invitationId },
          request: getAuditRequestContext(c),
        })
      }

      return c.json({ success: true })
    } catch (error: unknown) {
      const clerkError = describeClerkError(error)
      console.error('[Team] Invitation revoke failed:', {
        status: clerkError.status,
        code: clerkError.code,
      })
      return c.json({
        error: 'CLERK_INVITATION_REVOKE_FAILED',
        message: 'Failed to revoke invitation.',
        clerkError: publicClerkError(error),
      }, clerkFailureHttpStatus(error))
    }
  }
)

// ===== PROFILE ENDPOINTS =====

// GET /team/members/:staffId/profile - Get member profile with assignments
teamRoute.get('/members/:staffId/profile', async (c) => {
  const user = c.get('user')
  const staffId = c.req.param('staffId')

  // Resolve 'me' to current user's staffId
  const targetStaffId = staffId === 'me' ? user.staffId : staffId

  if (!targetStaffId) {
    return c.json({ error: 'Staff ID required' }, 400)
  }

  if (!isOrgAdmin(user) && targetStaffId !== user.staffId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Verify staff belongs to same org (allow viewing archived profiles)
  const staff = await prisma.staff.findFirst({
    where: {
      id: targetStaffId,
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isContractorAgent: true,
      avatarUrl: true,
      phoneNumber: true,
      title: true,
      notifyOnUpload: true,
      notifyOnChat: true,
      notifyOnAgreementSigned: true,
      notifyOnClientPayment: true,
      formSlug: true,
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: true,
      useOrgUploadLinkDefaults: true,
      defaultUploadLinkLanguage: true,
      isActive: true,
      deactivatedAt: true,
      paymentInfos: {
        select: {
          country: true,
          nameOnAccount: true,
          bankName: true,
          accountNumberEncrypted: true,
          accountNumberLast4: true,
          routingNumberEncrypted: true,
          routingNumberLast4: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
      _count: { select: { managedClientLinks: true } },
    },
  })

  if (!staff) {
    return c.json({ error: 'Staff not found' }, 404)
  }

  // Split name into firstName/lastName
  const nameParts = staff.name.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Always show only clients managed by this staff member.
  const clients = await prisma.client.findMany({
    where: {
      organizationId: user.organizationId,
      managers: { some: { staffId: targetStaffId } },
    },
    select: { id: true, name: true, phone: true, avatarUrl: true },
    take: 50,
    orderBy: { name: 'asc' },
  })
  const managedClientsList = await Promise.all(
    clients.map(async (cl) => ({
      ...cl,
      phone: serializePhone(user, cl.phone),
      avatarUrl: await resolveAvatarUrl(cl.avatarUrl),
    }))
  )
  const managedCount = staff._count.managedClientLinks

  const canEdit = canEditStaff(user, targetStaffId)

  return c.json({
    staff: {
      ...staff,
      _count: { managedClients: staff._count.managedClientLinks },
      firstName,
      lastName,
      avatarUrl: await resolveAvatarUrl(staff.avatarUrl),
      paymentInfos: staff.paymentInfos.map(serializeStaffPaymentInfo),
    },
    managedClients: managedClientsList,
    managedCount: managedCount,
    canEdit,
  })
})

// PATCH /team/members/:staffId/profile - Update profile (self or admin)
teamRoute.patch(
  '/members/:staffId/profile',
  zValidator('json', updateProfileSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      await logTeamMemberActivity(c, user, targetStaffId, {
        summary: 'Denied team profile edit attempt',
        action: ACTIVITY_ACTIONS.PROFILE.UPDATED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          result: 'denied',
          reason: 'forbidden_profile_edit',
        },
      })
      return c.json({ error: 'Can only edit your own profile' }, 403)
    }

    const { firstName, lastName, phoneNumber, title, notifyOnUpload, notifyOnChat, notifyOnAgreementSigned, notifyOnClientPayment } = c.req.valid('json')

    // Verify staff exists and belongs to org
    const staff = await prisma.staff.findFirst({
      where: {
        id: targetStaffId,
        organizationId: user.organizationId,
        isActive: true,
      },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    // ADMIN-only toggles: reject (not silently drop) so a MANAGER/MEMBER
    // poking the API directly gets an explicit error instead of fake success.
    if (
      (notifyOnAgreementSigned !== undefined || notifyOnClientPayment !== undefined) &&
      staff.role !== 'ADMIN'
    ) {
      return c.json({ error: 'Agreement/payment notification toggles are admin-only' }, 403)
    }

    // Compose full name from firstName + lastName
    const name = firstName !== undefined || lastName !== undefined
      ? [firstName ?? staff.name.split(/\s+/)[0], lastName ?? staff.name.split(/\s+/).slice(1).join(' ')].filter(Boolean).join(' ')
      : undefined

    // Update profile in DB
    const updated = await prisma.staff.update({
      where: { id: targetStaffId },
      data: {
        ...(name !== undefined && { name }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(title !== undefined && { title }),
        ...(notifyOnUpload !== undefined && { notifyOnUpload }),
        ...(notifyOnChat !== undefined && { notifyOnChat }),
        ...(notifyOnAgreementSigned !== undefined && { notifyOnAgreementSigned }),
        ...(notifyOnClientPayment !== undefined && { notifyOnClientPayment }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        title: true,
        notifyOnUpload: true,
        notifyOnChat: true,
        notifyOnAgreementSigned: true,
        notifyOnClientPayment: true,
      },
    })

    // Sync firstName/lastName to Clerk
    if ((firstName !== undefined || lastName !== undefined) && staff.clerkId) {
      try {
        await clerkClient.users.updateUser(staff.clerkId, {
          firstName: firstName ?? staff.name.split(/\s+/)[0],
          lastName: lastName ?? (staff.name.split(/\s+/).slice(1).join(' ') || undefined),
        })
      } catch (error) {
        console.error('[Team] Clerk name sync failed:', error)
        // Don't fail the request - DB is already updated
      }
    }

    // Audit log when admin edits another member's profile
    if (targetStaffId !== user.staffId) {
      logTeamAction('PROFILE_EDITED', targetStaffId, user.staffId, {
        oldValue: { name: staff.name, phoneNumber: staff.phoneNumber, notifyOnUpload: staff.notifyOnUpload, notifyOnChat: staff.notifyOnChat, notifyOnAgreementSigned: staff.notifyOnAgreementSigned, notifyOnClientPayment: staff.notifyOnClientPayment },
        newValue: { name, phoneNumber, notifyOnUpload, notifyOnChat, notifyOnAgreementSigned, notifyOnClientPayment },
      })
    }

    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId ?? targetStaffId,
      category: ACTIVITY_CATEGORIES.PROFILE,
      targetType: ACTIVITY_TARGET_TYPES.STAFF,
      targetId: targetStaffId,
      summary: 'Updated staff profile',
      action: ACTIVITY_ACTIONS.PROFILE.UPDATED,
      riskLevel: targetStaffId === user.staffId ? ActivityRiskLevel.LOW : ActivityRiskLevel.MEDIUM,
      metadata: {
        changedFields: getChangedFieldNames({
          firstName,
          lastName,
          phoneNumber,
          title,
          notifyOnUpload,
          notifyOnChat,
          notifyOnAgreementSigned,
          notifyOnClientPayment,
        }),
        editedSelf: targetStaffId === user.staffId,
      },
      request: getAuditRequestContext(c),
    })

    return c.json({ success: true, staff: { ...updated, avatarUrl: await resolveAvatarUrl(updated.avatarUrl) } })
  }
)

// PUT /team/members/:staffId/payment-info/:country - Upsert staff payment info (self or admin)
teamRoute.put(
  '/members/:staffId/payment-info/:country',
  zValidator('param', staffPaymentCountryParamSchema),
  zValidator('json', upsertStaffPaymentInfoBodySchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId
    const country = c.req.valid('param').country
    const body = c.req.valid('json')

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    const organizationId = user.organizationId
    if (!organizationId) {
      return c.json({ error: 'Organization required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      await logTeamMemberActivity(c, user, targetStaffId, {
        summary: 'Denied staff payment info update attempt',
        action: ACTIVITY_ACTIONS.TEAM.PAYMENT_INFO_UPDATED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          result: 'denied',
          reason: 'forbidden_payment_info_update',
          changedCountry: country,
        },
      })
      return c.json({ error: 'Forbidden' }, 403)
    }

    const parsed = upsertStaffPaymentInfoSchema.safeParse({ ...body, country })
    if (!parsed.success) {
      return c.json({ error: 'Invalid payment info', details: parsed.error.flatten() }, 400)
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: targetStaffId,
        organizationId,
        isActive: true,
      },
      select: { id: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    const input = parsed.data
    const routingNumber = input.country === 'US' ? input.routingNumber! : null
    const accountNumberEncrypted = encryptSensitiveValue(input.accountNumber)
    const routingNumberEncrypted = routingNumber ? encryptSensitiveValue(routingNumber) : null
    const paymentInfo = await prisma.staffPaymentInfo.upsert({
      where: {
        staffId_country: {
          staffId: targetStaffId,
          country: input.country,
        },
      },
      create: {
        organizationId,
        staffId: targetStaffId,
        country: input.country,
        nameOnAccount: input.nameOnAccount,
        bankName: input.bankName,
        accountNumberEncrypted,
        accountNumberLast4: last4(input.accountNumber),
        routingNumberEncrypted,
        routingNumberLast4: routingNumber ? last4(routingNumber) : null,
        updatedByStaffId: user.staffId,
      },
      update: {
        nameOnAccount: input.nameOnAccount,
        bankName: input.bankName,
        accountNumberEncrypted,
        accountNumberLast4: last4(input.accountNumber),
        routingNumberEncrypted,
        routingNumberLast4: routingNumber ? last4(routingNumber) : null,
        updatedByStaffId: user.staffId,
      },
      select: {
        country: true,
        nameOnAccount: true,
        bankName: true,
        accountNumberEncrypted: true,
        accountNumberLast4: true,
        routingNumberEncrypted: true,
        routingNumberLast4: true,
        updatedAt: true,
      },
    })

    await logTeamMemberActivity(c, user, targetStaffId, {
      summary: 'Updated staff payment info',
      action: ACTIVITY_ACTIONS.TEAM.PAYMENT_INFO_UPDATED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        changedCountry: input.country,
        changedFields: [
          'nameOnAccount',
          'bankName',
          'accountNumber',
          ...(routingNumber ? ['routingNumber'] : []),
        ],
        editedSelf: targetStaffId === user.staffId,
      },
    })

    return c.json({ success: true, paymentInfo: serializeStaffPaymentInfo(paymentInfo) })
  }
)

// DELETE /team/members/:staffId/payment-info/:country - Clear staff payment info (self or admin)
teamRoute.delete(
  '/members/:staffId/payment-info/:country',
  zValidator('param', staffPaymentCountryParamSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId
    const country = c.req.valid('param').country

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    const organizationId = user.organizationId
    if (!organizationId) {
      return c.json({ error: 'Organization required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      await logTeamMemberActivity(c, user, targetStaffId, {
        summary: 'Denied staff payment info clear attempt',
        action: ACTIVITY_ACTIONS.TEAM.PAYMENT_INFO_CLEARED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          result: 'denied',
          reason: 'forbidden_payment_info_clear',
          changedCountry: country,
        },
      })
      return c.json({ error: 'Forbidden' }, 403)
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: targetStaffId,
        organizationId,
        isActive: true,
      },
      select: { id: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    const deleted = await prisma.staffPaymentInfo.deleteMany({
      where: {
        organizationId,
        staffId: targetStaffId,
        country,
      },
    })

    await logTeamMemberActivity(c, user, targetStaffId, {
      summary: 'Cleared staff payment info',
      action: ACTIVITY_ACTIONS.TEAM.PAYMENT_INFO_CLEARED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: {
        changedCountry: country,
        changedFields: deleted.count > 0 ? ['paymentInfo'] : [],
        editedSelf: targetStaffId === user.staffId,
      },
    })

    return c.json({ success: true, country, deleted: deleted.count > 0 })
  }
)

// GET /team/members/:staffId/notification-subscriptions - Get subscriptions
teamRoute.get('/members/:staffId/notification-subscriptions', async (c) => {
  const user = c.get('user')
  const staffId = c.req.param('staffId')
  const targetStaffId = staffId === 'me' ? user.staffId : staffId

  if (!targetStaffId) {
    return c.json({ error: 'Staff ID required' }, 400)
  }

  if (!canEditStaff(user, targetStaffId)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Get current subscriptions grouped by type
  const allSubscriptions = await prisma.notificationSubscription.findMany({
    where: { subscriberId: targetStaffId },
    select: { targetStaffId: true, type: true },
  })

  const uploadSubscriptions = allSubscriptions
    .filter((s) => s.type === 'UPLOAD')
    .map((s) => s.targetStaffId)
  const chatSubscriptions = allSubscriptions
    .filter((s) => s.type === 'CHAT')
    .map((s) => s.targetStaffId)

  // Get all org members except self (for checkbox list)
  const members = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
      id: { not: targetStaffId },
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      _count: { select: { managedClientLinks: true } },
    },
    orderBy: { name: 'asc' },
  })

  const membersWithAvatars = await Promise.all(
    members.map(async (m) => ({
      ...m,
      _count: { managedClients: m._count.managedClientLinks },
      avatarUrl: await resolveAvatarUrl(m.avatarUrl),
    }))
  )

  return c.json({
    subscriptions: uploadSubscriptions, // backward compat
    uploadSubscriptions,
    chatSubscriptions,
    members: membersWithAvatars,
  })
})

// PUT /team/members/:staffId/notification-subscriptions - Replace subscriptions
teamRoute.put(
  '/members/:staffId/notification-subscriptions',
  zValidator('json', updateNotificationSubscriptionsSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      await logTeamMemberActivity(c, user, targetStaffId, {
        summary: 'Denied notification subscription edit attempt',
        action: ACTIVITY_ACTIONS.TEAM.NOTIFICATION_SUBSCRIPTIONS_UPDATED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          result: 'denied',
          reason: 'forbidden_subscription_edit',
        },
      })
      return c.json({ error: 'Forbidden' }, 403)
    }

    const { targetStaffIds, type } = c.req.valid('json')

    // Verify all target staff belong to same org
    if (targetStaffIds.length > 0) {
      const validCount = await prisma.staff.count({
        where: {
          id: { in: targetStaffIds },
          organizationId: user.organizationId,
          isActive: true,
        },
      })

      if (validCount !== targetStaffIds.length) {
        return c.json({ error: 'Some target staff IDs are invalid' }, 400)
      }
    }

    // Replace subscriptions scoped by type in a transaction
    await prisma.$transaction([
      prisma.notificationSubscription.deleteMany({
        where: { subscriberId: targetStaffId, type },
      }),
      ...(targetStaffIds.length > 0
        ? [
            prisma.notificationSubscription.createMany({
              data: targetStaffIds.map((tid) => ({
                subscriberId: targetStaffId,
                targetStaffId: tid,
                type,
              })),
            }),
          ]
        : []),
    ])

    // Audit log
    logTeamAction('NOTIFICATION_SUBSCRIPTIONS_UPDATED', targetStaffId, user.staffId, {
      newValue: { targetStaffIds, type },
    })
    await logTeamMemberActivity(c, user, targetStaffId, {
      summary: 'Updated notification subscriptions',
      action: ACTIVITY_ACTIONS.TEAM.NOTIFICATION_SUBSCRIPTIONS_UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      coalesceKey: `${ACTIVITY_ACTIONS.TEAM.NOTIFICATION_SUBSCRIPTIONS_UPDATED}:${targetStaffId}`,
      coalesceWindowMs: NOTIFICATION_SUBSCRIPTION_ACTIVITY_WINDOW_MS,
      metadata: {
        changedFields: ['notificationSubscriptions'],
        subscriptionType: type,
        count: targetStaffIds.length,
        editedSelf: targetStaffId === user.staffId,
      },
    })

    return c.json({ success: true })
  }
)

// POST /team/members/:staffId/avatar/presigned-url - Get upload URL (self or admin)
teamRoute.post(
  '/members/:staffId/avatar/presigned-url',
  zValidator('json', avatarPresignedUrlSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      return c.json({ error: 'Can only upload your own avatar' }, 403)
    }

    const { contentType, fileSize } = c.req.valid('json')

    // Verify staff exists
    const staff = await prisma.staff.findFirst({
      where: {
        id: targetStaffId,
        organizationId: user.organizationId,
        isActive: true,
      },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    // Generate key and presigned URL
    const key = generateAvatarKey(targetStaffId)
    const presignedUrl = await getSignedUploadUrl(key, contentType, fileSize)

    if (!presignedUrl) {
      return c.json({ error: 'Storage not configured' }, 503)
    }

    return c.json({
      presignedUrl,
      key,
      expiresIn: 900, // 15 minutes
    })
  }
)

// PATCH /team/members/:staffId/avatar - Confirm avatar upload (self or admin)
teamRoute.patch(
  '/members/:staffId/avatar',
  zValidator('json', avatarConfirmSchema),
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')
    const targetStaffId = staffId === 'me' ? user.staffId : staffId

    if (!targetStaffId) {
      return c.json({ error: 'Staff ID required' }, 400)
    }

    if (!canEditStaff(user, targetStaffId)) {
      return c.json({ error: 'Can only update your own avatar' }, 403)
    }

    const { r2Key } = c.req.valid('json')

    // Verify key belongs to this staff
    if (!r2Key.startsWith(`avatars/${targetStaffId}/`)) {
      await logStaffActivity({
        organizationId: user.organizationId,
        actorStaffId: user.staffId ?? targetStaffId,
        category: ACTIVITY_CATEGORIES.PROFILE,
        targetType: ACTIVITY_TARGET_TYPES.STAFF,
        targetId: targetStaffId,
        summary: 'Denied invalid staff avatar update',
        action: ACTIVITY_ACTIONS.PROFILE.AVATAR_UPDATED,
        riskLevel: ActivityRiskLevel.HIGH,
        metadata: {
          result: 'denied',
          reason: 'invalid_avatar_key',
        },
        request: getAuditRequestContext(c),
      })
      return c.json({ error: 'Invalid avatar key' }, 400)
    }

    // Verify staff exists
    const staff = await prisma.staff.findFirst({
      where: {
        id: targetStaffId,
        organizationId: user.organizationId,
        isActive: true,
      },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    // Store the R2 key directly (not a presigned URL) so it never expires.
    // Fresh presigned URLs are generated on read via resolveAvatarUrl().
    await prisma.staff.update({
      where: { id: targetStaffId },
      data: { avatarUrl: r2Key },
    })

    // Audit log when admin updates another member's avatar
    if (targetStaffId !== user.staffId) {
      logTeamAction('AVATAR_UPDATED', targetStaffId, user.staffId, {
        oldValue: staff.avatarUrl,
        newValue: r2Key,
      })
    }

    await logStaffActivity({
      organizationId: user.organizationId,
      actorStaffId: user.staffId ?? targetStaffId,
      category: ACTIVITY_CATEGORIES.PROFILE,
      targetType: ACTIVITY_TARGET_TYPES.STAFF,
      targetId: targetStaffId,
      summary: 'Updated staff avatar',
      action: ACTIVITY_ACTIONS.PROFILE.AVATAR_UPDATED,
      riskLevel: ActivityRiskLevel.LOW,
      metadata: {
        changedFields: ['avatarUrl'],
        editedSelf: targetStaffId === user.staffId,
      },
      request: getAuditRequestContext(c),
    })

    // Return a fresh presigned URL for immediate display
    const avatarUrl = await resolveAvatarUrl(r2Key)
    return c.json({ success: true, avatarUrl })
  }
)

export { teamRoute }
