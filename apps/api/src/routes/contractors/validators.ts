/**
 * Zod schemas for Contractor API endpoints
 */
import { z } from 'zod'
import { isValidSSN } from '../../services/crypto'

export const createContractorSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  ssn: z.string().refine(isValidSSN, 'Invalid SSN format'),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be 2-letter code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
})

export const updateContractorSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  ssn: z.string().refine(isValidSSN, 'Invalid SSN format').optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
})

export type CreateContractorInput = z.infer<typeof createContractorSchema>
export type UpdateContractorInput = z.infer<typeof updateContractorSchema>
