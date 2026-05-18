import { z } from 'zod'

export const caseIdParamSchema = z.object({
  caseId: z.string().min(1),
})

export const linkIdParamSchema = z.object({
  id: z.string().min(1),
})

export const extendUploadLinkSchema = z.object({
  days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]),
})

export type ExtendUploadLinkInput = z.infer<typeof extendUploadLinkSchema>
