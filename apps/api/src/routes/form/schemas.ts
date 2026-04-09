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

const businessTypeEnum = z.enum(['SOLE_PROPRIETORSHIP', 'LLC', 'PARTNERSHIP', 'S_CORP', 'C_CORP'])

export const getFormInfoParamsSchema = z.object({
  orgSlug: slugSchema,
})

export const getStaffFormInfoParamsSchema = z.object({
  orgSlug: slugSchema,
  staffSlug: slugSchema,
})

export const submitFormSchema = z.object({
  // Client type: determines creation path
  clientType: z.enum(['INDIVIDUAL', 'INDIVIDUAL_WITH_BUSINESS', 'BUSINESS']).default('INDIVIDUAL'),

  // Individual fields (required for INDIVIDUAL and INDIVIDUAL_WITH_BUSINESS)
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().max(254).optional(),
  taxYear: z.number().int().min(2020).max(2030),
  language: z.enum(['VI', 'EN']).default('VI'),
  staffSlug: slugSchema.optional(),

  // Business fields (required for INDIVIDUAL_WITH_BUSINESS and BUSINESS)
  businessName: z.string().trim().min(1).max(100).optional(),
  businessType: businessTypeEnum.optional(),
  businessEin: z.string().regex(/^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format').optional(),
  businessPhone: phoneSchema.optional(),
  businessEmail: z.string().email().max(254).optional(),
  businessAddress: z.string().max(200).optional(),
  businessCity: z.string().max(100).optional(),
  businessState: z.string().regex(/^[A-Z]{2}$/, 'Must be 2-letter state code').optional(),
  businessZip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be valid US zip code').optional(),
}).refine(
  (data) => {
    // Individual fields required for INDIVIDUAL and INDIVIDUAL_WITH_BUSINESS
    if (data.clientType !== 'BUSINESS') {
      return !!data.firstName && !!data.phone
    }
    return true
  },
  { message: 'First name and phone are required for individual clients', path: ['firstName'] }
).refine(
  (data) => {
    // Business fields required for BUSINESS and INDIVIDUAL_WITH_BUSINESS
    if (data.clientType === 'BUSINESS' || data.clientType === 'INDIVIDUAL_WITH_BUSINESS') {
      return !!data.businessName
    }
    return true
  },
  { message: 'Business name is required', path: ['businessName'] }
).refine(
  (data) => {
    // Business phone required for BUSINESS and INDIVIDUAL_WITH_BUSINESS
    // (avoids phone uniqueness collision when both clients share the same phone)
    if (data.clientType === 'BUSINESS' || data.clientType === 'INDIVIDUAL_WITH_BUSINESS') {
      return !!data.businessPhone
    }
    return true
  },
  { message: 'Business phone is required', path: ['businessPhone'] }
)

export type SubmitFormInput = z.infer<typeof submitFormSchema>
