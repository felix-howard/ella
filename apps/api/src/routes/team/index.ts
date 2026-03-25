/**
 * Team management routes
 * Endpoints for org member listing, invitations, role changes, and deactivation
 * Uses Clerk Backend API for org membership operations
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'
import { deactivateStaff } from '../../services/auth'
import { logTeamAction } from '../../services/audit-logger'
import { requireOrgAdmin, requireOrg } from '../../middleware/auth'
import { config } from '../../lib/config'
import type { AuthVariables } from '../../middleware/auth'
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateProfileSchema,
  updateNotificationSubscriptionsSchema,
  avatarPresignedUrlSchema,
  avatarConfirmSchema,
} from './schemas'
import {
  getSignedUploadUrl,
  generateAvatarKey,
  resolveAvatarUrl,
} from '../../services/storage'

const teamRoute = new Hono<{ Variables: AuthVariables }>()

/** Check if requester can edit target staff (self or org admin) */
function canEditStaff(user: { staffId: string | null; orgRole: string | null }, targetStaffId: string): boolean {
  return targetStaffId === user.staffId || user.orgRole === 'org:admin'
}

// All team routes require active org
teamRoute.use('*', requireOrg)

// GET /team/members - List active staff in current org
teamRoute.get('/members', async (c) => {
  const user = c.get('user')
  const includeArchived = c.req.query('includeArchived') === 'true'

  const members = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      ...(includeArchived ? {} : { isActive: true }),
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
      _count: { select: { managedClients: true } },
    },
    orderBy: { name: 'asc' },
  })

  // Always show actual managed client count (based on managedById relationship)
  const data = await Promise.all(
    members.map(async (m) => ({
      ...m,
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

    if (!user.clerkOrgId) {
      return c.json({ error: 'Organization not found' }, 400)
    }

    try {
      const invitation = await clerkClient.organizations.createOrganizationInvitation({
        organizationId: user.clerkOrgId,
        emailAddress,
        role,
        inviterUserId: user.id,
        redirectUrl: `${config.workspaceUrl}/accept-invitation`,
      })

      return c.json({
        success: true,
        invitation: {
          id: invitation.id,
          emailAddress: invitation.emailAddress,
          status: invitation.status,
        },
      })
    } catch (error: unknown) {
      console.error('[Team] Invite failed:', error)
      // Extract Clerk API error details
      const clerkErr = error as { errors?: Array<{ message?: string; longMessage?: string; code?: string }> }
      const firstErr = clerkErr.errors?.[0]
      const message = firstErr?.longMessage || firstErr?.message || (error instanceof Error ? error.message : 'Failed to send invitation')
      return c.json({ error: message }, 400)
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

    // Find target staff, verify same org
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    if (!staff.clerkId || !user.clerkOrgId) {
      return c.json({ error: 'Cannot update role: missing Clerk link' }, 400)
    }

    // Prevent demoting the last admin in the org
    if (role === 'org:member' && staff.role === 'ADMIN') {
      const adminCount = await prisma.staff.count({
        where: { organizationId: user.organizationId, role: 'ADMIN', isActive: true },
      })
      if (adminCount <= 1) {
        return c.json({ error: 'Cannot demote the last admin' }, 400)
      }
    }

    try {
      const oldRole = staff.role
      await clerkClient.organizations.updateOrganizationMembership({
        organizationId: user.clerkOrgId,
        userId: staff.clerkId,
        role,
      })

      // Sync role to DB immediately (don't wait for webhook)
      const dbRole = role === 'org:admin' ? 'ADMIN' : 'STAFF'
      await prisma.staff.update({
        where: { id: staffId },
        data: { role: dbRole },
      })

      // Audit log (async, non-blocking)
      logTeamAction('ROLE_CHANGED', staffId, user.staffId, { oldValue: oldRole, newValue: role })

      return c.json({ success: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      return c.json({ error: message }, 400)
    }
  }
)

// DELETE /team/members/:staffId - Deactivate staff member (admin only)
// Note: Clerk membership deletion triggers organizationMembership.deleted webhook
// which deactivates Staff in DB. We also call deactivateStaff() as backup.
teamRoute.delete(
  '/members/:staffId',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    // Cannot deactivate self
    if (staffId === user.staffId) {
      return c.json({ error: 'Cannot deactivate yourself' }, 400)
    }

    // Verify staff belongs to same org
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    // Remove from Clerk org first (if fails, DB stays consistent)
    if (staff.clerkId && user.clerkOrgId) {
      try {
        await clerkClient.organizations.deleteOrganizationMembership({
          organizationId: user.clerkOrgId,
          userId: staff.clerkId,
        })
      } catch (error) {
        console.error('[Team] Clerk membership removal failed:', error)
        // Continue with DB deactivation even if Clerk fails
      }
    }

    await deactivateStaff(staffId)

    // Audit log (async, non-blocking)
    logTeamAction('STAFF_DEACTIVATED', staffId, user.staffId, {
      oldValue: { name: staff.name, email: staff.email },
      newValue: { isActive: false },
    })

    return c.json({ success: true })
  }
)

// PATCH /team/members/:staffId/archive - Archive staff member (admin only)
// Sets isActive=false, deactivatedAt=now. Does NOT remove from Clerk org.
teamRoute.patch(
  '/members/:staffId/archive',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    // Cannot archive self
    if (staffId === user.staffId) {
      return c.json({ error: 'Cannot archive yourself' }, 400)
    }

    // Verify staff belongs to same org and is currently active
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found or already archived' }, 404)
    }

    await prisma.staff.update({
      where: { id: staffId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    })

    logTeamAction('STAFF_ARCHIVED', staffId, user.staffId, {
      oldValue: { isActive: true },
      newValue: { isActive: false, deactivatedAt: new Date().toISOString() },
    })

    return c.json({ success: true })
  }
)

// PATCH /team/members/:staffId/unarchive - Unarchive staff member (admin only)
// Sets isActive=true, clears deactivatedAt
teamRoute.patch(
  '/members/:staffId/unarchive',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    // Verify staff belongs to same org and is currently archived
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: false },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found or not archived' }, 404)
    }

    await prisma.staff.update({
      where: { id: staffId },
      data: {
        isActive: true,
        deactivatedAt: null,
      },
    })

    logTeamAction('STAFF_UNARCHIVED', staffId, user.staffId, {
      oldValue: { isActive: false },
      newValue: { isActive: true, deactivatedAt: null },
    })

    return c.json({ success: true })
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
        status: inv.status,
        createdAt: inv.createdAt,
      }))

      return c.json({ data })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch invitations'
      return c.json({ error: message }, 400)
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

      return c.json({ success: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to revoke invitation'
      return c.json({ error: message }, 400)
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
      avatarUrl: true,
      phoneNumber: true,
      notifyOnUpload: true,
      isActive: true,
      deactivatedAt: true,
      _count: { select: { managedClients: true } },
    },
  })

  if (!staff) {
    return c.json({ error: 'Staff not found' }, 404)
  }

  // Split name into firstName/lastName
  const nameParts = staff.name.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Always show only clients managed by this staff member (based on managedById)
  const clients = await prisma.client.findMany({
    where: { managedById: targetStaffId },
    select: { id: true, name: true, phone: true, avatarUrl: true },
    take: 50,
    orderBy: { name: 'asc' },
  })
  const managedClientsList = await Promise.all(
    clients.map(async (c) => ({ ...c, avatarUrl: await resolveAvatarUrl(c.avatarUrl) }))
  )
  const managedCount = staff._count.managedClients

  const canEdit = canEditStaff(user, targetStaffId)

  return c.json({
    staff: { ...staff, firstName, lastName, avatarUrl: await resolveAvatarUrl(staff.avatarUrl) },
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
      return c.json({ error: 'Can only edit your own profile' }, 403)
    }

    const { firstName, lastName, phoneNumber, notifyOnUpload } = c.req.valid('json')

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
        ...(notifyOnUpload !== undefined && { notifyOnUpload }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        notifyOnUpload: true,
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
        oldValue: { name: staff.name, phoneNumber: staff.phoneNumber, notifyOnUpload: staff.notifyOnUpload },
        newValue: { name, phoneNumber, notifyOnUpload },
      })
    }

    return c.json({ success: true, staff: { ...updated, avatarUrl: await resolveAvatarUrl(updated.avatarUrl) } })
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

  // Get current subscriptions
  const subscriptions = await prisma.notificationSubscription.findMany({
    where: { subscriberId: targetStaffId },
    select: { targetStaffId: true },
  })

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
      _count: { select: { managedClients: true } },
    },
    orderBy: { name: 'asc' },
  })

  const membersWithAvatars = await Promise.all(
    members.map(async (m) => ({
      ...m,
      avatarUrl: await resolveAvatarUrl(m.avatarUrl),
    }))
  )

  return c.json({
    subscriptions: subscriptions.map((s) => s.targetStaffId),
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
      return c.json({ error: 'Forbidden' }, 403)
    }

    const { targetStaffIds } = c.req.valid('json')

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

    // Replace all subscriptions in a transaction
    await prisma.$transaction([
      prisma.notificationSubscription.deleteMany({
        where: { subscriberId: targetStaffId },
      }),
      ...(targetStaffIds.length > 0
        ? [
            prisma.notificationSubscription.createMany({
              data: targetStaffIds.map((tid) => ({
                subscriberId: targetStaffId,
                targetStaffId: tid,
              })),
            }),
          ]
        : []),
    ])

    // Audit log
    logTeamAction('NOTIFICATION_SUBSCRIPTIONS_UPDATED', targetStaffId, user.staffId, {
      newValue: { targetStaffIds },
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

    // Return a fresh presigned URL for immediate display
    const avatarUrl = await resolveAvatarUrl(r2Key)
    return c.json({ success: true, avatarUrl })
  }
)

export { teamRoute }
