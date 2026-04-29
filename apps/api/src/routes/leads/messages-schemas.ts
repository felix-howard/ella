/**
 * Zod schemas for Lead Messages API endpoints
 */
import { z } from 'zod'

// Send a Staff→Lead message (outbound)
export const sendLeadMessageSchema = z.object({
  // Message.content is @db.VarChar(5000); keep headroom for SMS segmentation upstream
  content: z.string().min(1, 'Message content is required').max(5000),
  channel: z.literal('SMS'),
})

// Query params for listing a lead's messages
export const listLeadMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// Mark-as-read: optional `upTo` clamps the read-watermark to the newest message
// the client has actually observed, preventing a race where an inbound arrives
// during the GET→POST round-trip and gets silently marked read.
export const markLeadMessagesReadSchema = z.object({
  upTo: z.coerce.date().optional(),
})

export type SendLeadMessageInput = z.infer<typeof sendLeadMessageSchema>
export type ListLeadMessagesQuery = z.infer<typeof listLeadMessagesQuerySchema>
export type MarkLeadMessagesReadInput = z.infer<typeof markLeadMessagesReadSchema>
