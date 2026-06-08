/**
 * Zod schemas for agreement routes (staff + public).
 *
 * Kept separate so handlers stay thin and the schemas are trivially testable.
 */
import { z } from 'zod'
import { MIN_EXPIRY_DAYS, MAX_EXPIRY_DAYS } from '../../services/agreements/token-service'

// ---------- Params ----------

export const leadIdParamSchema = z.object({
  leadId: z.string().min(1),
})

export const leadAndAgreementIdParamSchema = z.object({
  leadId: z.string().min(1),
  id: z.string().min(1),
})

/** Legacy alias retained for transitional callers (see Phase 06 NDA aliases). */
export const leadAndNdaIdParamSchema = leadAndAgreementIdParamSchema

export const tokenParamSchema = z.object({
  token: z.string().min(8).max(128),
})

// ---------- Staff bodies ----------

// Mirrors `AGREEMENT_HTML_MAX_LENGTH` in `lib/agreements/sanitize-html.ts` so
// zod rejects oversized payloads before they reach the sanitizer.
export const AGREEMENT_CONTENT_HTML_MAX = 50_000

/** Legacy alias retained for transitional callers. */
export const NDA_CONTENT_HTML_MAX = AGREEMENT_CONTENT_HTML_MAX

export const agreementTypeSchema = z.enum([
  'NDA',
  'ENGAGEMENT_LETTER',
  'SERVICE_AGREEMENT',
  'CUSTOM',
])

// Decimal-as-string with optional 2-decimal places, accepting a positive value.
// Service layer hands this directly to Prisma which coerces to Decimal.
const depositAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'depositAmount must be a positive decimal')
  .refine((v) => Number(v) > 0, { message: 'depositAmount must be greater than 0' })

export const createAgreementBodySchema = z
  .object({
    type: agreementTypeSchema.default('NDA'),
    title: z.string().min(1).max(200).optional(),
    contentHtml: z.string().max(AGREEMENT_CONTENT_HTML_MAX).optional(),
    templateId: z.string().min(1).optional(),
    /**
     * R2 key of a previously-uploaded source PDF (from the upload-pdf endpoint).
     * When set, the agreement body is the uploaded PDF — contentHtml/templateId
     * must be omitted and the type-specific content rules are bypassed.
     */
    uploadedPdfKey: z.string().min(1).max(512).optional(),
    /** Pass `null` to explicitly skip deposit; omit/positive string to apply. */
    depositAmount: depositAmountSchema.optional().nullable(),
    /** Staff-only context, never shown to recipient or in PDF. */
    internalNote: z.string().max(2000).trim().optional(),
    /** Link validity window in days. Server clamps to supported range. */
    expiryDays: z
      .number()
      .int()
      .min(MIN_EXPIRY_DAYS)
      .max(MAX_EXPIRY_DAYS)
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Uploaded-PDF path: the PDF IS the body. Reject mixing it with HTML/template
    // sources, then short-circuit the content-required rules below.
    if (val.uploadedPdfKey) {
      if (val.contentHtml || val.templateId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['uploadedPdfKey'],
          message: 'uploadedPdfKey cannot be combined with contentHtml or templateId',
        })
      }
      return
    }
    // CUSTOM requires content (no template fallback exists)
    if (val.type === 'CUSTOM' && !val.contentHtml) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentHtml'],
        message: 'CUSTOM agreement requires contentHtml',
      })
    }
    // CUSTOM cannot reference a template (no template type is CUSTOM).
    if (val.type === 'CUSTOM' && val.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templateId'],
        message: 'CUSTOM agreement cannot reference a template',
      })
    }
    // Non-NDA structured types require either a templateId snapshot or inline content
    if (
      (val.type === 'ENGAGEMENT_LETTER' || val.type === 'SERVICE_AGREEMENT') &&
      !val.templateId &&
      !val.contentHtml
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templateId'],
        message: 'Provide either templateId or contentHtml',
      })
    }
  })

/** Legacy alias retained for transitional callers (NDA-only payload shape). */
export const createNdaBodySchema = z
  .object({
    contentHtml: z.string().max(AGREEMENT_CONTENT_HTML_MAX).optional(),
  })
  .strict()

export const previewAgreementBodySchema = z
  .object({
    type: agreementTypeSchema.default('NDA'),
    contentHtml: z.string().max(AGREEMENT_CONTENT_HTML_MAX).optional(),
    /** Optional title shown as the PDF heading. Defaults to the template's built-in title. */
    title: z.string().min(1).max(200).optional(),
  })
  .strict()

/** Legacy alias retained for transitional callers. */
export const previewNdaBodySchema = previewAgreementBodySchema

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

export const extendAgreementBodySchema = z
  .object({
    /** New validity window from now. Server clamps; omit to reuse stored expiryDays. */
    days: z
      .number()
      .int()
      .min(MIN_EXPIRY_DAYS)
      .max(MAX_EXPIRY_DAYS)
      .optional(),
  })
  .strict()

// ---------- Public bodies ----------

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

export const signAgreementBodySchema = z
  .object({
    signerName: z.string().min(2).max(120),
    signerTitle: z.string().min(2).max(80),
    signaturePngDataUrl: z
      .string()
      .startsWith(PNG_DATA_URL_PREFIX, {
        message: 'signaturePngDataUrl must be a PNG data URL',
      })
      .max(800_000),
    agreementChecked: z.literal(true),
    // Back-compat: older portal builds supplied business rep fields. New
    // signing UI sends signerName + signerTitle for every client type.
    clientAuthRepName: z.string().min(2).max(120).optional(),
    clientAuthRepTitle: z.string().min(2).max(80).optional(),
  })
  .strict()

/** Legacy alias retained for transitional callers. */
export const signNdaBodySchema = signAgreementBodySchema

export type UpdateDepositBody = z.infer<typeof updateDepositBodySchema>
export type ExtendAgreementBody = z.infer<typeof extendAgreementBodySchema>
export type SignAgreementBody = z.infer<typeof signAgreementBodySchema>
export type SignNdaBody = SignAgreementBody
export type CreateAgreementBody = z.infer<typeof createAgreementBodySchema>
export type CreateNdaBody = z.infer<typeof createNdaBodySchema>
export type PreviewAgreementBody = z.infer<typeof previewAgreementBodySchema>
export type PreviewNdaBody = PreviewAgreementBody
export { PNG_DATA_URL_PREFIX }
