/**
 * Shared Docs API Schemas
 * Zod validation for shared-docs endpoints.
 */
import { z } from 'zod'

export const sharedDocStatusSchema = z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED'])

export const shareableDocumentResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.number(),
  filename: z.string(),
  fileSize: z.number(),
  status: sharedDocStatusSchema,
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

export const sectionVersionSchema = z.object({
  version: z.number(),
  uploadedAt: z.string(),
  status: sharedDocStatusSchema,
})

export const sectionDetailResponseSchema = z.object({
  document: shareableDocumentResponseSchema,
  magicLink: magicLinkResponseSchema.nullable(),
  versions: z.array(sectionVersionSchema),
})

export const listSectionsResponseSchema = z.object({
  documents: z.array(
    shareableDocumentResponseSchema.extend({
      magicLink: magicLinkResponseSchema.nullable(),
    })
  ),
})

export const createOrVersionResponseSchema = z.object({
  document: shareableDocumentResponseSchema,
  magicLink: magicLinkResponseSchema,
  portalUrl: z.string(),
})

export const portalDraftResponseSchema = z.object({
  title: z.string(),
  clientName: z.string(),
  clientLanguage: z.string(),
  taxYear: z.number(),
  version: z.number(),
  filename: z.string(),
  uploadedAt: z.string(),
  pdfUrl: z.string(),
})

export type ShareableDocumentResponse = z.infer<typeof shareableDocumentResponseSchema>
export type SharedDocMagicLinkResponse = z.infer<typeof magicLinkResponseSchema>
export type SectionDetailResponse = z.infer<typeof sectionDetailResponseSchema>
export type ListSectionsResponse = z.infer<typeof listSectionsResponseSchema>
export type CreateOrVersionResponse = z.infer<typeof createOrVersionResponseSchema>
export type PortalDraftResponse = z.infer<typeof portalDraftResponseSchema>
