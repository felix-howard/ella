import { z } from 'zod'

export const caseIdParamSchema = z.object({
  caseId: z.string().min(1),
})

export const linkIdParamSchema = z.object({
  id: z.string().min(1),
})
