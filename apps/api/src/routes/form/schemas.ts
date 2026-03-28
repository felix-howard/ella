/**
 * Public Form Schemas
 * Zod validation for public client intake form endpoints
 */
import { z } from 'zod'

const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')

const phoneSchema = z
  .string()
  .regex(/^\+\d{7,15}$/, 'Phone must be in E.164 format (e.g., +1XXXXXXXXXX)')

export const getFormInfoParamsSchema = z.object({
  orgSlug: slugSchema,
})

export const getStaffFormInfoParamsSchema = z.object({
  orgSlug: slugSchema,
  staffSlug: slugSchema,
})

export const submitFormSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().max(50).optional(),
  phone: phoneSchema,
  taxYear: z.number().int().min(2020).max(2030),
  language: z.enum(['VI', 'EN']).default('VI'),
  staffSlug: slugSchema.optional(),
})

export type SubmitFormInput = z.infer<typeof submitFormSchema>
