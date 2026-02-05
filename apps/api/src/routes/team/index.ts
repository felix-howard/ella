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
  staffIdParamSchema,
  invitationIdParamSchema,
} from './schemas'

const teamRoute = new Hono<{ Variables: AuthVariables }>()

// All team routes require active org
teamRoute.use('*', requireOrg)

// GET /team/members - List active staff in current org
teamRoute.get('/members', async (c) => {
  const user = c.get('user')

  const members = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      lastLoginAt: true,
      _count: { select: { clientAssignments: true } },
    },
    orderBy: { name: 'asc' },
  })

  return c.json({ data: members })
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

// GET /team/members/:staffId/assignments - List client assignments for a staff member (admin only)
teamRoute.get(
  '/members/:staffId/assignments',
  requireOrgAdmin,
  async (c) => {
    const user = c.get('user')
    const staffId = c.req.param('staffId')

    // Verify staff belongs to same org
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404)
    }

    const assignments = await prisma.clientAssignment.findMany({
      where: {
        staffId,
        client: { organizationId: user.organizationId },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return c.json({ data: assignments })
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

export { teamRoute }
