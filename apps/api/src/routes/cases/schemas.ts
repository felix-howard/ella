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
  engagementId: z.string().regex(/^c[a-z0-9]{24}$/).optional(), // Optional for backward compat
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

// Add checklist item schema (staff override)
export const addChecklistItemSchema = z.object({
  docType: z.string().min(1, 'Document type is required').max(100),
  reason: z.string().max(500, 'Reason too long (max 500 chars)').optional(),
  expectedCount: z.number().int().min(1).max(99).default(1),
})

// Skip checklist item schema
export const skipChecklistItemSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long (max 500 chars)'),
})

// Update checklist item notes schema
export const updateChecklistItemNotesSchema = z.object({
  notes: z.string().max(1000, 'Notes too long (max 1000 chars)'),
})

// Case ID param validation (CUID format)
export const caseIdParamSchema = z.object({
  id: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid case ID format'),
})

// Group documents schema for manual batch grouping
export const groupDocumentsSchema = z.object({
  forceRegroup: z.boolean().optional().default(false),
})

// Type exports
export type CreateCaseInput = z.infer<typeof createCaseSchema>
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>
export type SkipChecklistItemInput = z.infer<typeof skipChecklistItemSchema>
export type GroupDocumentsInput = z.infer<typeof groupDocumentsSchema>
