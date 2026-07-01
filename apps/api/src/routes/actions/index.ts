/**
 * Actions API routes
 * Action queue management for staff dashboard
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { listActionsQuerySchema, updateActionSchema } from './schemas'
import type { ActionType, ActionPriority, Prisma } from '@ella/db'
import type { AuthVariables } from '../../middleware/auth'
import { actionInclude, buildActionOwnerScope, serializeAction } from './action-route-helpers'

const actionsRoute = new Hono<{ Variables: AuthVariables }>()

// GET /actions - Get action queue (grouped by priority)
actionsRoute.get('/', zValidator('query', listActionsQuerySchema), async (c) => {
  const { type, priority, assignedToId, isCompleted } = c.req.valid('query')
  const user = c.get('user')

  const where: Prisma.ActionWhereInput = buildActionOwnerScope(user)
  if (type) where.type = type as ActionType
  if (priority) where.priority = priority as ActionPriority
  if (assignedToId !== undefined) {
    where.assignedToId = assignedToId || null
  }
  if (isCompleted !== undefined) where.isCompleted = isCompleted

  // Default to showing incomplete actions
  if (isCompleted === undefined) {
    where.isCompleted = false
  }

  const actions = await prisma.action.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    include: actionInclude,
  })

  // Group by priority
  const grouped = {
    urgent: actions.filter((a) => a.priority === 'URGENT'),
    high: actions.filter((a) => a.priority === 'HIGH'),
    normal: actions.filter((a) => a.priority === 'NORMAL'),
    low: actions.filter((a) => a.priority === 'LOW'),
  }

  const stats = {
    total: actions.length,
    urgent: grouped.urgent.length,
    high: grouped.high.length,
    normal: grouped.normal.length,
    low: grouped.low.length,
  }

  const formatActions = (list: typeof actions) => list.map((a) => serializeAction(user, a))

  return c.json({
    urgent: formatActions(grouped.urgent),
    high: formatActions(grouped.high),
    normal: formatActions(grouped.normal),
    low: formatActions(grouped.low),
    stats,
  })
})

// GET /actions/:id - Get single action detail
actionsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const action = await prisma.action.findFirst({
    where: { id, ...buildActionOwnerScope(user) },
    include: {
      taxCase: {
        include: {
          client: true,
          checklistItems: { include: { template: true } },
        },
      },
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessName: true,
          status: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  if (!action) {
    return c.json({ error: 'NOT_FOUND', message: 'Action not found' }, 404)
  }

  return c.json(serializeAction(user, action))
})

// PATCH /actions/:id - Update action (assign, complete)
actionsRoute.patch('/:id', zValidator('json', updateActionSchema), async (c) => {
  const id = c.req.param('id')
  const { assignedToId, isCompleted } = c.req.valid('json')
  const user = c.get('user')

  // Verify access before update (org-scoped)
  const existing = await prisma.action.findFirst({
    where: { id, ...buildActionOwnerScope(user) },
    select: { id: true },
  })
  if (!existing) {
    return c.json({ error: 'NOT_FOUND', message: 'Action not found' }, 404)
  }

  const updateData: Record<string, unknown> = {}

  if (assignedToId !== undefined) {
    const nextAssignedToId = assignedToId || null
    if (nextAssignedToId) {
      const assignedStaff = await prisma.staff.findFirst({
        where: {
          id: nextAssignedToId,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      })
      if (!assignedStaff) {
        return c.json({ error: 'INVALID_ASSIGNEE', message: 'Assigned staff not found' }, 400)
      }
    }
    updateData.assignedToId = nextAssignedToId
  }

  if (isCompleted !== undefined) {
    updateData.isCompleted = isCompleted
    if (isCompleted) {
      updateData.completedAt = new Date()
    } else {
      updateData.completedAt = null
    }
  }

  const action = await prisma.action.update({
    where: { id },
    data: updateData,
    include: actionInclude,
  })

  return c.json(serializeAction(user, action))
})

export { actionsRoute }
