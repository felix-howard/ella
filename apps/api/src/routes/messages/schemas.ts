/**
 * Zod schemas for Messages API endpoints
 */
import { z } from 'zod'

export const replyModeSchema = z.enum(['DIRECT', 'EN_TO_VI'])

export const composeTranslationSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  sourceText: z.string().min(1, 'Message content is required').max(1000),
  sourceLanguage: z.literal('EN'),
  targetLanguage: z.literal('VI'),
})

export const composeTranslationMetadataSchema = z.object({
  sourceContent: z.string().min(1, 'Source content is required').max(1000),
  sourceLanguage: z.literal('EN'),
  targetLanguage: z.literal('VI'),
  edited: z.boolean(),
})

export const updateReplyModeSchema = z.object({
  replyMode: replyModeSchema,
})

// Send message input
export const sendMessageSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  content: z.string().min(1, 'Message content is required').max(1000),
  channel: z.enum(['SMS', 'PORTAL', 'SYSTEM']).default('SMS'),
  templateName: z.string().optional(),
  translation: composeTranslationMetadataSchema.optional(),
})

export const translateMessageSchema = z.object({
  targetLanguage: z.string().default('EN'),
})

// Query params for listing messages
export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const markCaseMessagesReadSchema = z.object({
  upTo: z.coerce.date().optional(),
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
export type TranslateMessageInput = z.infer<typeof translateMessageSchema>
export type ReplyModeInput = z.infer<typeof replyModeSchema>
export type ComposeTranslationInput = z.infer<typeof composeTranslationSchema>
export type ComposeTranslationMetadataInput = z.infer<typeof composeTranslationMetadataSchema>
export type UpdateReplyModeInput = z.infer<typeof updateReplyModeSchema>
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>
export type MarkCaseMessagesReadInput = z.infer<typeof markCaseMessagesReadSchema>
