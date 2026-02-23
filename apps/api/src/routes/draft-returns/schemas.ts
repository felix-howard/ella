/**
 * Draft Return API Schemas
 * Zod validation for draft return endpoints
 */
import { z } from 'zod'

// Response schemas
export const draftReturnResponseSchema = z.object({
  id: z.string(),
  version: z.number(),
  filename: z.string(),
  fileSize: z.number(),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED']),
  viewCount: z.number(),
  lastViewedAt: z.string().nullable(),
  uploadedAt: z.string(),
  uploadedBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
})

export const magicLinkResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.string().nullable(),
  isActive: z.boolean(),
  usageCount: z.number(),
  lastUsedAt: z.string().nullable(),
})

export const getDraftReturnResponseSchema = z.object({
  draftReturn: draftReturnResponseSchema.nullable(),
  magicLink: magicLinkResponseSchema.nullable(),
  versions: z.array(
    z.object({
      version: z.number(),
      uploadedAt: z.string(),
      status: z.string(),
    })
  ),
})

export const uploadDraftReturnResponseSchema = z.object({
  draftReturn: draftReturnResponseSchema,
  magicLink: magicLinkResponseSchema,
  portalUrl: z.string(),
})

// Portal response schemas
export const portalDraftResponseSchema = z.object({
  clientName: z.string(),
  clientLanguage: z.string(),
  taxYear: z.number(),
  version: z.number(),
  filename: z.string(),
  uploadedAt: z.string(),
  pdfUrl: z.string(), // Signed R2 URL
})

export type DraftReturnResponse = z.infer<typeof draftReturnResponseSchema>
export type MagicLinkResponse = z.infer<typeof magicLinkResponseSchema>
export type GetDraftReturnResponse = z.infer<typeof getDraftReturnResponseSchema>
export type UploadDraftReturnResponse = z.infer<typeof uploadDraftReturnResponseSchema>
export type PortalDraftResponse = z.infer<typeof portalDraftResponseSchema>
