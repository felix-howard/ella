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
  amountBox1: z.string().refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0 },
    'Compensation amount must be greater than 0'
  ),
  amountBox4: z.string().optional().refine(
    (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
    'Tax withheld must be a valid amount'
  ),
})
