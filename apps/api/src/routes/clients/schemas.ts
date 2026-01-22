/**
 * Zod schemas for Client API endpoints
 */
import { z } from 'zod'

// Phone validation (E.164 format for US)
const phoneSchema = z
  .string()
  .regex(/^\+1\d{10}$/, 'Phone must be +1XXXXXXXXXX format')

/**
 * ABA Routing Number Validation (H2 fix: server-side validation)
 * Uses checksum algorithm per MICR standard
 */
function isValidRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false

  // ABA checksum: 3×(d1+d4+d7) + 7×(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10)
  const digits = routing.split('').map(Number)
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8])

  return checksum % 10 === 0
}

// Regex for valid intakeAnswer keys: alphanumeric, underscores, starts with letter
// Prevents prototype pollution and ensures clean key names
const VALID_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

// Dangerous keys that could pollute Object prototype - must be explicitly blocked
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])

// Shared intakeAnswers value schema for reuse
const intakeAnswersValueSchema = z.union([
  z.boolean(),
  z.number().min(0).max(9999),
  z.string().max(500),
  // Allow arrays for dependents and other list data
  z.array(z.record(z.union([z.boolean(), z.number(), z.string()]))),
  // Allow nested objects for complex structured data
  z.record(z.union([z.boolean(), z.number(), z.string()])),
])

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

  // Full intake answers JSON (stores all dynamic question answers)
  // Supports: booleans, numbers, strings, arrays, and nested objects
  // Validation: max 200 top-level keys, valid key names, no prototype pollution
  intakeAnswers: z.record(intakeAnswersValueSchema)
    .optional()
    .refine(
      (val) => !val || Object.keys(val).length <= 200,
      { message: 'Too many intake answers (max 200)' }
    )
    .refine(
      (val) => !val || Object.keys(val).every((key) => VALID_KEY_PATTERN.test(key)),
      { message: 'Invalid intake answer key format (must be alphanumeric, start with letter, max 64 chars)' }
    )
    .refine(
      (val) => !val || Object.keys(val).every((key) => !DANGEROUS_KEYS.has(key)),
      { message: 'Reserved key name not allowed (potential prototype pollution)' }
    )
    // H2 fix: Server-side bank routing number validation
    .refine(
      (val) => {
        if (!val?.refundRoutingNumber) return true
        const routing = String(val.refundRoutingNumber)
        return isValidRoutingNumber(routing)
      },
      { message: 'Invalid bank routing number (ABA checksum failed)' }
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

// Cascade cleanup input
export const cascadeCleanupSchema = z.object({
  changedKey: z.string().min(1, 'Changed key is required'),
  caseId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid case ID format').optional(),
})

// Update client profile input (for PATCH /clients/:id/profile)
// Supports partial updates to intakeAnswers (merges with existing)
export const updateProfileSchema = z.object({
  // Direct profile field
  filingStatus: z.string().optional(),

  // Partial intakeAnswers update (merged with existing, not replaced)
  // Uses shared schema with same validation as create endpoint
  intakeAnswers: z.record(intakeAnswersValueSchema)
    .optional()
    .refine(
      (val) => !val || Object.keys(val).length <= 200,
      { message: 'Too many intake answers (max 200)' }
    )
    .refine(
      (val) => !val || Object.keys(val).every((key) => VALID_KEY_PATTERN.test(key)),
      { message: 'Invalid intake answer key format (must be alphanumeric, start with letter, max 64 chars)' }
    )
    .refine(
      (val) => !val || Object.keys(val).every((key) => !DANGEROUS_KEYS.has(key)),
      { message: 'Reserved key name not allowed (potential prototype pollution)' }
    )
    // H2 fix: Server-side bank routing number validation
    .refine(
      (val) => {
        if (!val?.refundRoutingNumber) return true
        const routing = String(val.refundRoutingNumber)
        return isValidRoutingNumber(routing)
      },
      { message: 'Invalid bank routing number (ABA checksum failed)' }
    ),
})

// Type exports
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
export type CascadeCleanupInput = z.infer<typeof cascadeCleanupSchema>
