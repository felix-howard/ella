/**
 * Client assignment routes
 * CRUD for staff-to-client assignment management (admin only)
 * All operations scoped to current organization
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { requireOrgAdmin, requireOrg } from '../../middleware/auth'
import type { AuthVariables } from '../../middleware/auth'
import {
  createAssignmentSchema,
  bulkAssignSchema,
  transferSchema,
  listAssignmentsQuerySchema,
} from './schemas'

const clientAssignmentsRoute = new Hono<{ Variables: AuthVariables }>()

// All assignment routes require active org + admin role
clientAssignmentsRoute.use('*', requireOrg)
clientAssignmentsRoute.use('*', requireOrgAdmin)

// POST /client-assignments - Create single assignment
clientAssignmentsRoute.post(
  '/',
  zValidator('json', createAssignmentSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId, staffId } = c.req.valid('json')

    // Verify both client and staff belong to current org
    const [client, staff] = await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, organizationId: user.organizationId },
        select: { id: true },
      }),
      prisma.staff.findFirst({
        where: { id: staffId, organizationId: user.organizationId, isActive: true },
        select: { id: true },
      }),
    ])

    if (!client) {
      return c.json({ error: 'Client not found in organization' }, 404)
    }
    if (!staff) {
      return c.json({ error: 'Staff not found in organization' }, 404)
    }

    try {
      const assignment = await prisma.clientAssignment.create({
        data: {
          clientId,
          staffId,
          assignedById: user.staffId,
        },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          staff: { select: { id: true, name: true, email: true } },
        },
      })

      return c.json({ data: assignment }, 201)
    } catch (error: unknown) {
      // Unique constraint violation = duplicate assignment
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return c.json({ error: 'Assignment already exists' }, 409)
      }
      throw error
    }
  }
)

// POST /client-assignments/bulk - Bulk create assignments
clientAssignmentsRoute.post(
  '/bulk',
  zValidator('json', bulkAssignSchema),
  async (c) => {
    const user = c.get('user')
    const { clientIds, staffId } = c.req.valid('json')

    // Verify staff belongs to org
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: user.organizationId, isActive: true },
      select: { id: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff not found in organization' }, 404)
    }

    // Verify all clients belong to org
    const validClients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organizationId: user.organizationId },
      select: { id: true },
    })

    const validClientIds = validClients.map((cl) => cl.id)
    const invalidCount = clientIds.length - validClientIds.length

    if (validClientIds.length === 0) {
      return c.json({ error: 'No valid clients found in organization' }, 404)
    }

    const result = await prisma.clientAssignment.createMany({
      data: validClientIds.map((clientId) => ({
        clientId,
        staffId,
        assignedById: user.staffId,
      })),
      skipDuplicates: true,
    })

    return c.json({
      data: {
        created: result.count,
        skipped: validClientIds.length - result.count,
        invalidClients: invalidCount,
      },
    })
  }
)

// DELETE /client-assignments/:id - Remove single assignment
clientAssignmentsRoute.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  // Find assignment and verify client belongs to org
  const assignment = await prisma.clientAssignment.findUnique({
    where: { id },
    include: { client: { select: { organizationId: true } } },
  })

  if (!assignment || assignment.client.organizationId !== user.organizationId) {
    return c.json({ error: 'Assignment not found' }, 404)
  }

  await prisma.clientAssignment.delete({ where: { id } })

  return c.json({ success: true })
})

// GET /client-assignments - List assignments with optional filters
clientAssignmentsRoute.get(
  '/',
  zValidator('query', listAssignmentsQuerySchema),
  async (c) => {
    const user = c.get('user')
    const { staffId, clientId } = c.req.valid('query')

    // Build where clause: always org-scoped via client or staff
    const where: Record<string, unknown> = {}
    if (staffId) where.staffId = staffId
    if (clientId) where.clientId = clientId

    // Scope to org via client's organizationId
    where.client = { organizationId: user.organizationId }

    const assignments = await prisma.clientAssignment.findMany({
      where,
      include: {
        staff: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return c.json({ data: assignments })
  }
)

// PUT /client-assignments/transfer - Transfer client from one staff to another
clientAssignmentsRoute.put(
  '/transfer',
  zValidator('json', transferSchema),
  async (c) => {
    const user = c.get('user')
    const { clientId, fromStaffId, toStaffId } = c.req.valid('json')

    // Verify all entities belong to org
    const [client, fromStaff, toStaff] = await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, organizationId: user.organizationId },
        select: { id: true },
      }),
      prisma.staff.findFirst({
        where: { id: fromStaffId, organizationId: user.organizationId },
        select: { id: true },
      }),
      prisma.staff.findFirst({
        where: { id: toStaffId, organizationId: user.organizationId, isActive: true },
        select: { id: true },
      }),
    ])

    if (!client) return c.json({ error: 'Client not found in organization' }, 404)
    if (!fromStaff) return c.json({ error: 'Source staff not found in organization' }, 404)
    if (!toStaff) return c.json({ error: 'Target staff not found in organization' }, 404)

    // Interactive transaction: verify + delete old + create new (race-safe)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.clientAssignment.findFirst({
        where: { clientId, staffId: fromStaffId },
      })
      if (!existing) {
        throw new Error('Assignment not found')
      }

      await tx.clientAssignment.delete({ where: { id: existing.id } })
      await tx.clientAssignment.create({
        data: {
          clientId,
          staffId: toStaffId,
          assignedById: user.staffId,
        },
      })
    })

    return c.json({ success: true })
  }
)

export { clientAssignmentsRoute }
