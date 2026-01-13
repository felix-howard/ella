/**
 * Zod schemas for Actions API endpoints
 */
import { z } from 'zod'

// Action type enum
export const actionTypeEnum = z.enum([
  'VERIFY_DOCS',
  'AI_FAILED',
  'BLURRY_DETECTED',
  'READY_FOR_ENTRY',
  'REMINDER_DUE',
  'CLIENT_REPLIED',
])

// Action priority enum
export const actionPriorityEnum = z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW'])

// Query params for listing actions
export const listActionsQuerySchema = z.object({
  type: actionTypeEnum.optional(),
  priority: actionPriorityEnum.optional(),
  assignedToId: z.string().optional(),
  isCompleted: z.coerce.boolean().optional(),
})

// Update action input
export const updateActionSchema = z.object({
  assignedToId: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
})

// Type exports
export type ListActionsQuery = z.infer<typeof listActionsQuerySchema>
export type UpdateActionInput = z.infer<typeof updateActionSchema>
