/**
 * Zod schemas for TaxEngagement API endpoints
 * Supports multi-year client engagement management
 */
import { z } from 'zod'

// Engagement status enum matching Prisma EngagementStatus
export const engagementStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'COMPLETE',
  'ARCHIVED',
])

// Engagement ID param validation (CUID format)
export const engagementIdParamSchema = z.object({
  id: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid engagement ID format'),
})

// Create engagement input
export const createEngagementSchema = z.object({
  clientId: z.string().min(1).regex(/^c[a-z0-9]{24}$/, 'Invalid client ID format'),
  taxYear: z.number().int().min(2020).max(2030),
  copyFromEngagementId: z.string().regex(/^c[a-z0-9]{24}$/).optional(),
  // Profile fields (optional, can be filled later)
  filingStatus: z.string().optional(),
  intakeAnswers: z.record(z.unknown()).optional(),
})

// Update engagement input (profile fields)
export const updateEngagementSchema = z.object({
  status: engagementStatusEnum.optional(),
  filingStatus: z.string().optional(),
  hasW2: z.boolean().optional(),
  hasBankAccount: z.boolean().optional(),
  hasInvestments: z.boolean().optional(),
  hasKidsUnder17: z.boolean().optional(),
  numKidsUnder17: z.number().int().min(0).max(10).optional(),
  paysDaycare: z.boolean().optional(),
  hasKids17to24: z.boolean().optional(),
  hasSelfEmployment: z.boolean().optional(),
  hasRentalProperty: z.boolean().optional(),
  businessName: z.string().optional(),
  ein: z.string().regex(/^(\d{2}-\d{7}|\d{9})$/, 'EIN must be XX-XXXXXXX or XXXXXXXXX format').optional(),
  hasEmployees: z.boolean().optional(),
  hasContractors: z.boolean().optional(),
  has1099K: z.boolean().optional(),
  intakeAnswers: z.record(z.unknown()).optional(),
})

// Query params for listing engagements
export const listEngagementsQuerySchema = z.object({
  clientId: z.string().regex(/^c[a-z0-9]{24}$/).optional(),
  taxYear: z.coerce.number().int().optional(),
  status: engagementStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Type exports
export type CreateEngagementInput = z.infer<typeof createEngagementSchema>
export type UpdateEngagementInput = z.infer<typeof updateEngagementSchema>
export type ListEngagementsQuery = z.infer<typeof listEngagementsQuerySchema>
