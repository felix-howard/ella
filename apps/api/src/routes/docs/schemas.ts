/**
 * Zod schemas for Digital Documents API endpoints
 */
import { z } from 'zod'

// Document type enum
export const docTypeEnum = z.enum([
  'SSN_CARD',
  'DRIVER_LICENSE',
  'PASSPORT',
  'W2',
  'FORM_1099_INT',
  'FORM_1099_DIV',
  'FORM_1099_NEC',
  'FORM_1099_MISC',
  'FORM_1099_K',
  'FORM_1099_R',
  'FORM_1099_G',
  'FORM_1099_SSA',
  'BANK_STATEMENT',
  'PROFIT_LOSS_STATEMENT',
  'BUSINESS_LICENSE',
  'EIN_LETTER',
  'FORM_1098',
  'FORM_1098_T',
  'RECEIPT',
  'BIRTH_CERTIFICATE',
  'DAYCARE_RECEIPT',
  'OTHER',
  'UNKNOWN',
])

// Digital doc status enum
export const digitalDocStatusEnum = z.enum([
  'PENDING',
  'EXTRACTED',
  'VERIFIED',
  'PARTIAL',
  'FAILED',
])

// Classify doc input
export const classifyDocSchema = z.object({
  docType: docTypeEnum,
})

// Verify doc input (for updating extracted data)
export const verifyDocSchema = z.object({
  extractedData: z.record(z.any()),
  status: z.enum(['VERIFIED', 'PARTIAL']),
})

// Quick verify/reject action input
export const verifyActionSchema = z.object({
  action: z.enum(['verify', 'reject']),
  notes: z.string().optional(),
})

// Select best image from group input
export const selectBestImageSchema = z.object({
  imageId: z.string().min(1),
})

// Type exports
export type ClassifyDocInput = z.infer<typeof classifyDocSchema>
export type VerifyDocInput = z.infer<typeof verifyDocSchema>
export type VerifyActionInput = z.infer<typeof verifyActionSchema>
export type SelectBestImageInput = z.infer<typeof selectBestImageSchema>
