/**
 * Zod schemas for ClientGroup API endpoints
 */
import { z } from 'zod'

// CUID format validation (use built-in Zod cuid validator)
const cuidSchema = z.string().cuid()

// Create client group
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  clientIds: z.array(cuidSchema).min(1, 'At least one client ID required'),
})

// Update client group
export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  addClientIds: z.array(cuidSchema).optional(),
  removeClientIds: z.array(cuidSchema).optional(),
})

// Group ID param
export const groupIdParamSchema = z.object({
  id: cuidSchema,
})

// List groups query
export const listGroupsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
})

// Type exports
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>
