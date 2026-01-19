/**
 * Zod schemas for Client API endpoints
 */
import { z } from 'zod'

// Phone validation (E.164 format for US)
const phoneSchema = z
  .string()
  .regex(/^\+1\d{10}$/, 'Phone must be +1XXXXXXXXXX format')

// Client profile for intake questions
export const clientProfileSchema = z.object({
  taxTypes: z
    .array(z.enum(['FORM_1040', 'FORM_1120S', 'FORM_1065']))
    .min(1, 'At least one tax type required'),
  taxYear: z.number().int().min(2020).max(2030),

  // 1040 questions (legacy fields for backward compatibility)
  filingStatus: z.string().optional(),
  hasW2: z.boolean().default(false),
  hasBankAccount: z.boolean().default(false),
  hasInvestments: z.boolean().default(false),
  hasKidsUnder17: z.boolean().default(false),
  numKidsUnder17: z.number().int().min(0).max(10).default(0),
  paysDaycare: z.boolean().default(false),
  hasKids17to24: z.boolean().default(false),
  hasSelfEmployment: z.boolean().default(false),
  hasRentalProperty: z.boolean().default(false),

  // Business questions (1120S/1065)
  businessName: z.string().optional(),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format')
    .optional(),
  hasEmployees: z.boolean().default(false),
  hasContractors: z.boolean().default(false),
  has1099K: z.boolean().default(false),

  // NEW: Full intake answers JSON (stores all dynamic question answers)
  // Validation: max 200 keys, strings max 500 chars, numbers 0-99
  intakeAnswers: z.record(
    z.union([
      z.boolean(),
      z.number().min(0).max(99),
      z.string().max(500),
    ])
  )
    .optional()
    .refine(
      (val) => !val || Object.keys(val).length <= 200,
      { message: 'Too many intake answers (max 200)' }
    ),
})

// Create client input
export const createClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  email: z.string().email().optional(),
  language: z.enum(['VI', 'EN']).default('VI'),
  profile: clientProfileSchema,
})

// Update client input
export const updateClientSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email().nullable().optional(),
  language: z.enum(['VI', 'EN']).optional(),
})

// Client ID param validation (CUID format)
export const clientIdParamSchema = z.object({
  id: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid client ID format'),
})

// Query params for listing clients
export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z
    .enum([
      'INTAKE',
      'WAITING_DOCS',
      'IN_PROGRESS',
      'READY_FOR_ENTRY',
      'ENTRY_COMPLETE',
      'REVIEW',
      'FILED',
    ])
    .optional(),
})

// Type exports
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
