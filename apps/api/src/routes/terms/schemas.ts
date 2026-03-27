import { z } from 'zod'

export const acceptTermsSchema = z.object({
  version: z.string().min(1),
  pdfBase64: z.string().min(1).max(14_000_000), // ~10MB PDF max
})

export const downloadParamsSchema = z.object({
  acceptanceId: z.string().cuid(),
})
