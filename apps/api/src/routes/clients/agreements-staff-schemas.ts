/**
 * Param schemas for staff-facing client agreement routes.
 * Body schemas are reused as-is from the lead route's neutral schemas module
 * (createAgreementBodySchema, previewAgreementBodySchema, updateDepositBodySchema)
 * since they carry no entity-specific fields.
 */
import { z } from 'zod'

// cuid shape: leading 'c' followed by 24 lowercase alphanumerics
const CUID_REGEX = /^c[a-z0-9]{24}$/

export const clientIdParamSchema = z.object({
  clientId: z.string().min(1).regex(CUID_REGEX, 'Invalid client ID'),
})

export const clientAndAgreementIdParamSchema = z.object({
  clientId: z.string().min(1).regex(CUID_REGEX, 'Invalid client ID'),
  id: z.string().min(1).regex(CUID_REGEX, 'Invalid agreement ID'),
})

/** Legacy alias — preserved for transitional callers. */
export const clientAndNdaIdParamSchema = clientAndAgreementIdParamSchema
