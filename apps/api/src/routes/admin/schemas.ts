/**
 * Admin API Schemas
 * Validation schemas for admin configuration endpoints
 */
import { z } from 'zod'

// Shared enums
const TaxTypeEnum = z.enum(['FORM_1040', 'FORM_1120S', 'FORM_1065'])
const FieldTypeEnum = z.enum(['BOOLEAN', 'SELECT', 'NUMBER', 'TEXT'])
const MessageTemplateCategoryEnum = z.enum(['WELCOME', 'REMINDER', 'MISSING', 'BLURRY', 'COMPLETE', 'GENERAL', 'SCHEDULE_C'])

/**
 * JSON string validator with size limit
 * Validates that string is valid JSON and within size limit
 */
const jsonStringSchema = z
  .string()
  .max(2000, 'JSON too large (max 2000 chars)')
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true // Empty is valid
      try {
        JSON.parse(val)
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid JSON format' }
  )
  .optional()

/**
 * Condition JSON validator
 * Validates condition object structure: { key: boolean | string | number }
 */
const conditionJsonSchema = z
  .string()
  .max(2000, 'Condition too large (max 2000 chars)')
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true
      try {
        const parsed = JSON.parse(val)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return false
        }
        // Validate all values are boolean, string, or number
        return Object.values(parsed).every(
          (v) => typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number'
        )
      } catch {
        return false
      }
    },
    { message: 'Invalid condition format. Expected JSON object with boolean/string/number values' }
  )
  .optional()

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
  options: jsonStringSchema, // Validated JSON string for SELECT options
  condition: conditionJsonSchema, // Validated condition JSON
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
  docType: z.string().min(1).max(50), // DocType enum value with size limit
  labelVi: z.string().min(1).max(200),
  labelEn: z.string().min(1).max(200),
  descriptionVi: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  hintVi: z.string().max(300).optional(),
  hintEn: z.string().max(300).optional(),
  isRequired: z.boolean().default(true),
  condition: conditionJsonSchema, // Validated condition JSON
  category: z.string().min(1).max(50),
  expectedCount: z.number().int().min(1).max(100).default(1),
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
  aliases: z.array(z.string().max(100)).max(50).default([]), // Max 50 aliases, each max 100 chars
  keywords: z.array(z.string().max(100)).max(50).default([]), // Max 50 keywords, each max 100 chars
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateDocTypeLibrarySchema = createDocTypeLibrarySchema.partial().omit({
  code: true,
})

// ============================================
// MESSAGE TEMPLATES SCHEMAS
// ============================================

export const messageTemplateIdParamSchema = z.object({
  id: z.string().min(1),
})

export const listMessageTemplatesQuerySchema = z.object({
  category: MessageTemplateCategoryEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const createMessageTemplateSchema = z.object({
  category: MessageTemplateCategoryEnum,
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  placeholders: z.array(z.string().max(50)).max(10).default([]),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateMessageTemplateSchema = createMessageTemplateSchema.partial()

// Type exports
export type CreateIntakeQuestionInput = z.infer<typeof createIntakeQuestionSchema>
export type UpdateIntakeQuestionInput = z.infer<typeof updateIntakeQuestionSchema>
export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateSchema>
export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>
export type CreateDocTypeLibraryInput = z.infer<typeof createDocTypeLibrarySchema>
export type UpdateDocTypeLibraryInput = z.infer<typeof updateDocTypeLibrarySchema>
export type CreateMessageTemplateInput = z.infer<typeof createMessageTemplateSchema>
export type UpdateMessageTemplateInput = z.infer<typeof updateMessageTemplateSchema>
