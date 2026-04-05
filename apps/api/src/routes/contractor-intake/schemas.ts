/**
 * Contractor Intake Schemas
 * Zod validation for public contractor intake form endpoints
 */
import { z } from 'zod'
import { isValidTIN } from '../../services/crypto'

export const intakeTokenParamSchema = z.object({
  token: z.string().min(1),
})

export const submitContractorIntakeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  ssn: z.string().refine(isValidTIN, 'Invalid SSN/EIN format'),
  tinType: z.enum(['SSN', 'EIN']).default('SSN'),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be 2-letter code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 or 9 digits'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
})
