/**
 * Zod schemas for Messages API endpoints
 */
import { z } from 'zod'

// Send message input
export const sendMessageSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  content: z.string().min(1, 'Message content is required').max(1000),
  channel: z.enum(['SMS', 'SYSTEM']).default('SMS'),
  templateName: z.string().optional(),
})

// Query params for listing messages
export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// Query params for listing conversations (inbox)
export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // z.coerce.boolean() treats string "false" as truthy! Use custom transform
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
})

// Type exports
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>
