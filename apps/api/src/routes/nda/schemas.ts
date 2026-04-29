/**
 * Zod schemas for NDA routes (staff + public).
 *
 * Kept separate so handlers stay thin and the schemas are trivially testable.
 */
import { z } from 'zod'

// ---------- Params ----------

export const leadIdParamSchema = z.object({
  leadId: z.string().min(1),
})

export const leadAndNdaIdParamSchema = z.object({
  leadId: z.string().min(1),
  id: z.string().min(1),
})

export const tokenParamSchema = z.object({
  token: z.string().min(8).max(128),
})

// ---------- Staff bodies ----------

// Mirrors `NDA_HTML_MAX_LENGTH` in `lib/nda/sanitize-html.ts` so zod rejects
// oversized payloads before they reach the sanitizer.
export const NDA_CONTENT_HTML_MAX = 50_000

export const createNdaBodySchema = z
  .object({
    contentHtml: z.string().max(NDA_CONTENT_HTML_MAX).optional(),
  })
  .strict()

export const previewNdaBodySchema = z
  .object({
    contentHtml: z.string().max(NDA_CONTENT_HTML_MAX).optional(),
  })
  .strict()

export const updateDepositBodySchema = z
  .object({
    depositStatus: z.enum(['PENDING', 'PAID', 'REFUNDED', 'FORFEITED']),
    depositNote: z.string().max(1000).optional().nullable(),
    depositPaidAt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .nullable(),
  })
  .strict()

// ---------- Public bodies ----------

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

export const signNdaBodySchema = z
  .object({
    signerName: z.string().min(1).max(120),
    signaturePngDataUrl: z
      .string()
      .startsWith(PNG_DATA_URL_PREFIX, {
        message: 'signaturePngDataUrl must be a PNG data URL',
      })
      .max(800_000),
    agreementChecked: z.literal(true),
  })
  .strict()

export type UpdateDepositBody = z.infer<typeof updateDepositBodySchema>
export type SignNdaBody = z.infer<typeof signNdaBodySchema>
export type CreateNdaBody = z.infer<typeof createNdaBodySchema>
export type PreviewNdaBody = z.infer<typeof previewNdaBodySchema>
export { PNG_DATA_URL_PREFIX }
