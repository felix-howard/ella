/**
 * Zod schemas for Business API endpoints
 */
import { z } from 'zod'

const businessTypeSchema = z.enum([
  'SOLE_PROPRIETORSHIP',
  'LLC',
  'PARTNERSHIP',
  'S_CORP',
  'C_CORP',
])

export const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(200),
  type: businessTypeSchema,
  ein: z.string().regex(/^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format'),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be 2-letter code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits'),
})

export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: businessTypeSchema.optional(),
  ein: z.string().regex(/^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format').optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().length(2, 'State must be 2-letter code').optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits').optional(),
})

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>
