/**
 * Client assignment validation schemas
 * Zod schemas for client-staff assignment CRUD endpoints
 */
import { z } from 'zod'

export const createAssignmentSchema = z.object({
  clientId: z.string().min(1),
  staffId: z.string().min(1),
})

export const bulkAssignSchema = z.object({
  clientIds: z.array(z.string().min(1)).min(1).max(50),
  staffId: z.string().min(1),
})

export const transferSchema = z.object({
  clientId: z.string().min(1),
  fromStaffId: z.string().min(1),
  toStaffId: z.string().min(1),
})

export const assignmentIdParamSchema = z.object({
  id: z.string().min(1),
})

export const listAssignmentsQuerySchema = z.object({
  staffId: z.string().optional(),
  clientId: z.string().optional(),
})
