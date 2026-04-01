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

export const bulkSaveContractorsSchema = z.object({
  contractors: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    ssn: z.string().refine(isValidSSN, 'Invalid SSN format'),
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().min(5),
    email: z.string().email().optional().or(z.literal('')),
    amountPaid: z.number().min(0), // Displayed in review table; stored on Form1099NEC in Phase 3
  })).min(1, 'At least one contractor required'),
  taxYear: z.number().min(2000).max(2100),
})

export type CreateContractorInput = z.infer<typeof createContractorSchema>
export type UpdateContractorInput = z.infer<typeof updateContractorSchema>
export type BulkSaveContractorsInput = z.infer<typeof bulkSaveContractorsSchema>
