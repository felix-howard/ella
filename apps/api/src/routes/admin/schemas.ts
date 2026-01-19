/**
 * Admin API Schemas
 * Validation schemas for admin configuration endpoints
 */
import { z } from 'zod'

// Shared enums
const TaxTypeEnum = z.enum(['FORM_1040', 'FORM_1120S', 'FORM_1065'])
const FieldTypeEnum = z.enum(['BOOLEAN', 'SELECT', 'NUMBER', 'TEXT'])

// ============================================
// INTAKE QUESTIONS SCHEMAS
// ============================================

export const intakeQuestionIdParamSchema = z.object({
  id: z.string().min(1),
})

export const listIntakeQuestionsQuerySchema = z.object({
  taxType: TaxTypeEnum.optional(),
  section: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export const createIntakeQuestionSchema = z.object({
  questionKey: z.string().min(1).max(50),
  taxTypes: z.array(TaxTypeEnum).min(1),
  labelVi: z.string().min(1).max(200),
  labelEn: z.string().min(1).max(200),
  hintVi: z.string().max(300).optional(),
  hintEn: z.string().max(300).optional(),
  fieldType: FieldTypeEnum,
  options: z.string().optional(), // JSON string
  condition: z.string().optional(), // JSON string
  section: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateIntakeQuestionSchema = createIntakeQuestionSchema.partial()

// ============================================
// CHECKLIST TEMPLATES SCHEMAS
// ============================================

export const checklistTemplateIdParamSchema = z.object({
  id: z.string().min(1),
})

export const listChecklistTemplatesQuerySchema = z.object({
  taxType: TaxTypeEnum.optional(),
  category: z.string().optional(),
})

export const createChecklistTemplateSchema = z.object({
  taxType: TaxTypeEnum,
  docType: z.string().min(1), // DocType enum value
  labelVi: z.string().min(1).max(200),
  labelEn: z.string().min(1).max(200),
  descriptionVi: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  hintVi: z.string().max(300).optional(),
  hintEn: z.string().max(300).optional(),
  isRequired: z.boolean().default(true),
  condition: z.string().optional(), // JSON string
  category: z.string().min(1).max(50),
  expectedCount: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateChecklistTemplateSchema = createChecklistTemplateSchema.partial().omit({
  taxType: true,
  docType: true,
})

// ============================================
// DOC TYPE LIBRARY SCHEMAS
// ============================================

export const docTypeLibraryIdParamSchema = z.object({
  id: z.string().min(1),
})

export const listDocTypeLibraryQuerySchema = z.object({
  category: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  search: z.string().optional(),
})

export const createDocTypeLibrarySchema = z.object({
  code: z.string().min(1).max(50),
  labelVi: z.string().min(1).max(200),
  labelEn: z.string().min(1).max(200),
  descriptionVi: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  category: z.string().min(1).max(50),
  aliases: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateDocTypeLibrarySchema = createDocTypeLibrarySchema.partial().omit({
  code: true,
})

// Type exports
export type CreateIntakeQuestionInput = z.infer<typeof createIntakeQuestionSchema>
export type UpdateIntakeQuestionInput = z.infer<typeof updateIntakeQuestionSchema>
export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateSchema>
export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>
export type CreateDocTypeLibraryInput = z.infer<typeof createDocTypeLibrarySchema>
export type UpdateDocTypeLibraryInput = z.infer<typeof updateDocTypeLibrarySchema>
