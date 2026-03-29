import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/)
export const uuidSchema = z.string().cuid()

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// API response wrapper
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  })

// IntakeAnswers validation schema with size limit (max 50KB to prevent DoS)
const MAX_INTAKE_ANSWERS_SIZE = 50 * 1024 // 50KB

export const intakeAnswersSchema = z
  .record(z.union([z.boolean(), z.number(), z.string()]))
  .refine(
    (data) => JSON.stringify(data).length <= MAX_INTAKE_ANSWERS_SIZE,
    { message: `Intake answers exceeds maximum size of ${MAX_INTAKE_ANSWERS_SIZE / 1024}KB` }
  )

// ============================================
// LEAD / MARKETING
// ============================================

export const leadStatusEnum = z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST'])
export type LeadStatus = z.infer<typeof leadStatusEnum>

export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: phoneSchema,
  email: z.string().email().max(254).optional().nullable(),
  businessName: z.string().max(200).optional().nullable(),
  source: z.string().max(100).optional(),
  notes: z.string().max(5000).optional().nullable(),
  organizationId: z.string().cuid(),
})
export type CreateLeadInput = z.infer<typeof createLeadSchema>

export const updateLeadSchema = z.object({
  status: leadStatusEnum.optional(),
  notes: z.string().max(5000).optional().nullable(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().max(254).optional().nullable(),
  businessName: z.string().max(200).optional().nullable(),
})
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>

export const listLeadsQuerySchema = paginationSchema.extend({
  status: leadStatusEnum.optional(),
  search: z.string().max(100).optional(),
})
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>

export const convertLeadSchema = z.object({
  managedById: z.string().cuid().optional(),
  language: z.enum(['VI', 'EN']).default('VI'),
  taxYear: z.number().int().min(2020).max(2099),
  sendWelcomeSms: z.boolean().default(true),
  customMessage: z.string().max(500).optional(),
})
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>

export const bulkSmsSchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(100),
  message: z.string().min(1).max(500),
  formLinkType: z.enum(['org', 'staff']).default('org'),
  staffSlug: z.string().optional(),
}).refine(
  (data) => data.formLinkType !== 'staff' || (data.staffSlug && data.staffSlug.length > 0),
  { message: 'staffSlug is required when formLinkType is "staff"', path: ['staffSlug'] }
)
export type BulkSmsInput = z.infer<typeof bulkSmsSchema>
