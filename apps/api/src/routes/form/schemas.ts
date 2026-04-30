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

// Single business entry shape for the multi-business `businesses` array.
// All fields except `name` are optional — when phone is missing for the
// INDIVIDUAL_WITH_BUSINESS path, the API falls back to the individual's phone.
export const businessInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  businessType: businessTypeEnum.optional(),
  ein: z.string().regex(/^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format').optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().max(254).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().regex(/^[A-Z]{2}$/, 'Must be 2-letter state code').optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be valid US zip code').optional(),
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

  // Multi-business: when provided, takes precedence over the flat business
  // fields below. Used by the self-serve form to add multiple businesses.
  businesses: z.array(businessInputSchema).max(10).optional(),

  // Legacy flat business fields (single business) — kept for backwards compat.
  // If `businesses` array is provided, these are ignored.
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
    // At least one business name required for BUSINESS / INDIVIDUAL_WITH_BUSINESS.
    // Accepts either the new `businesses[]` array or the legacy flat fields.
    if (data.clientType === 'BUSINESS' || data.clientType === 'INDIVIDUAL_WITH_BUSINESS') {
      const hasArray = Array.isArray(data.businesses) && data.businesses.length > 0
      return hasArray || !!data.businessName
    }
    return true
  },
  { message: 'Business name is required', path: ['businessName'] }
).refine(
  (data) => {
    // BUSINESS-only path needs a phone (no individual phone to fall back on).
    // For INDIVIDUAL_WITH_BUSINESS the API falls back to the individual's phone.
    if (data.clientType === 'BUSINESS') {
      const arrayPhone = data.businesses?.[0]?.phone
      return !!(arrayPhone || data.businessPhone)
    }
    return true
  },
  { message: 'Business phone is required', path: ['businessPhone'] }
)

export type SubmitFormInput = z.infer<typeof submitFormSchema>
export type BusinessInput = z.infer<typeof businessInputSchema>
