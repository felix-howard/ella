/**
 * Zod schemas for Portal API endpoints (Public)
 */
import { z } from 'zod'

// Token param schema
export const tokenParamSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

// Type exports
export type TokenParam = z.infer<typeof tokenParamSchema>
