import { z } from 'zod'

// Common validation schemas
export const emailSchema = z.string().email()
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/)
export const uuidSchema = z.string().cuid()

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// API response wrapper
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  })
