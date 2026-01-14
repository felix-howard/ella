/**
 * Zod schemas for Tax Cases API endpoints
 */
import { z } from 'zod'

// Tax case status enum
export const taxCaseStatusEnum = z.enum([
  'INTAKE',
  'WAITING_DOCS',
  'IN_PROGRESS',
  'READY_FOR_ENTRY',
  'ENTRY_COMPLETE',
  'REVIEW',
  'FILED',
])

// Create case input
export const createCaseSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  taxYear: z.number().int().min(2020).max(2030),
  taxTypes: z
    .array(z.enum(['FORM_1040', 'FORM_1120S', 'FORM_1065']))
    .min(1, 'At least one tax type required'),
})

// Update case input
export const updateCaseSchema = z.object({
  status: taxCaseStatusEnum.optional(),
})

// Query params for listing cases
export const listCasesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: taxCaseStatusEnum.optional(),
  taxYear: z.coerce.number().int().optional(),
  clientId: z.string().optional(),
})

// Raw image status enum
export const rawImageStatusEnum = z.enum([
  'UPLOADED',
  'PROCESSING',
  'CLASSIFIED',
  'LINKED',
  'BLURRY',
  'UNCLASSIFIED',
])

// Query params for listing images (with pagination)
export const listImagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: rawImageStatusEnum.optional(),
})

// Query params for listing docs (with pagination)
export const listDocsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// Type exports
export type CreateCaseInput = z.infer<typeof createCaseSchema>
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>
