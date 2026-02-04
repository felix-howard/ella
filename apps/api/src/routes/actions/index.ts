/**
 * Actions API routes
 * Action queue management for staff dashboard
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import { listActionsQuerySchema, updateActionSchema } from './schemas'
import type { ActionType, ActionPriority } from '@ella/db'
import { buildClientScopeFilter } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

const actionsRoute = new Hono<{ Variables: AuthVariables }>()

// GET /actions - Get action queue (grouped by priority)
actionsRoute.get('/', zValidator('query', listActionsQuerySchema), async (c) => {
  const { type, priority, assignedToId, isCompleted } = c.req.valid('query')
  const user = c.get('user')

  // Scope actions through taxCase -> client relation
  const where: Record<string, unknown> = {
    taxCase: { client: buildClientScopeFilter(user) },
  }
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
    include: {
      taxCase: {
        include: {
          client: { select: { id: true, name: true, phone: true } },
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
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

  const formatActions = (list: typeof actions) =>
    list.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }))

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
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    include: {
      taxCase: {
        include: {
          client: true,
          checklistItems: { include: { template: true } },
        },
      },
      assignedTo: true,
    },
  })

  if (!action) {
    return c.json({ error: 'NOT_FOUND', message: 'Action not found' }, 404)
  }

  return c.json({
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  })
})

// PATCH /actions/:id - Update action (assign, complete)
actionsRoute.patch('/:id', zValidator('json', updateActionSchema), async (c) => {
  const id = c.req.param('id')
  const { assignedToId, isCompleted } = c.req.valid('json')
  const user = c.get('user')

  // Verify access before update (org-scoped)
  const existing = await prisma.action.findFirst({
    where: { id, taxCase: { client: buildClientScopeFilter(user) } },
    select: { id: true },
  })
  if (!existing) {
    return c.json({ error: 'NOT_FOUND', message: 'Action not found' }, 404)
  }

  const updateData: Record<string, unknown> = {}

  if (assignedToId !== undefined) {
    updateData.assignedToId = assignedToId
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
    include: {
      taxCase: {
        include: { client: { select: { id: true, name: true } } },
      },
      assignedTo: { select: { id: true, name: true } },
    },
  })

  return c.json({
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  })
})

export { actionsRoute }
