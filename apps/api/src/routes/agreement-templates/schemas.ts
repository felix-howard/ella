/**
 * Zod schemas for agreement-template routes. Kept separate so handlers stay
 * thin and schemas are trivially testable.
 *
 * `CUSTOM` is intentionally excluded from template type — CUSTOM agreements
 * carry per-send unique content (paste-from-Docs flow) and reject `templateId`
 * at the agreement-create boundary, so a CUSTOM template would be unusable.
 */
import { z } from 'zod'
import { AGREEMENT_HTML_MAX_LENGTH } from '../../lib/agreements/sanitize-html'

export const templateTypeSchema = z.enum([
  'NDA',
  'ENGAGEMENT_LETTER',
  'SERVICE_AGREEMENT',
])

// Upper bound matches Prisma column `Decimal(10, 2)` — 8 digits before the
// decimal point. Without this, an oversized input would surface as a Prisma
// 500 instead of a 422 with a useful message.
const DEPOSIT_AMOUNT_MAX = 99_999_999.99

const depositAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'defaultDepositAmount must be a non-negative decimal')
  .refine((v) => {
    const n = Number(v)
    return n >= 0 && n <= DEPOSIT_AMOUNT_MAX
  }, {
    message: `defaultDepositAmount must be between 0 and ${DEPOSIT_AMOUNT_MAX}`,
  })

export const idParamSchema = z.object({
  id: z.string().min(1),
})

// Trim before length validation so whitespace-padded input like "   ab   "
// can't sneak past `min(3)` only to be normalised to "ab" at write time.
const templateNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)

export const createTemplateBodySchema = z
  .object({
    name: templateNameSchema,
    type: templateTypeSchema,
    contentHtml: z.string().min(1).max(AGREEMENT_HTML_MAX_LENGTH),
    defaultDepositAmount: depositAmountSchema.optional().nullable(),
  })
  .strict()

// `type` is intentionally omitted: a template's type is part of its identity
// (snapshotted Agreement.type matches templateId.type at send time). Allowing
// type drift after sends would orphan the type-vs-content invariant for any
// future send that re-snapshots from the template under the old assumption.
// To switch a template's type, create a new template and archive the old.
export const updateTemplateBodySchema = z
  .object({
    name: templateNameSchema.optional(),
    contentHtml: z.string().min(1).max(AGREEMENT_HTML_MAX_LENGTH).optional(),
    defaultDepositAmount: depositAmountSchema.optional().nullable(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  })

export const listQuerySchema = z
  .object({
    type: templateTypeSchema.optional(),
    // `?includeArchived=true` opts archived templates back in (Settings UI uses
    // this for the "show archived" toggle).
    includeArchived: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .strict()

export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>
