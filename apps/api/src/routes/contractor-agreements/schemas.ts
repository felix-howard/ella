import { z } from 'zod'

export const acceptContractorAgreementSchema = z
  .object({
    version: z.string().min(1),
    signaturePngDataUrl: z
      .string()
      .startsWith('data:image/png;base64,', 'Must be a PNG data URL')
      .max(700_000),
  })
  .strict()

export const downloadParamsSchema = z.object({
  acceptanceId: z.string().cuid(),
})

export const acceptanceParamsSchema = z.object({
  staffId: z.union([z.literal('me'), z.string().cuid()]),
})
