import { generateContent, isGeminiConfigured } from './gemini-client'
import { cleanTranslatedText } from './message-translator'

const MAX_REPLY_TRANSLATION_CHARS = 1000

export type ReplyTranslationError =
  | 'AI_NOT_CONFIGURED'
  | 'EMPTY_MESSAGE'
  | 'MESSAGE_TOO_LONG'
  | 'TRANSLATION_FAILED'

export interface ReplyTranslationSuccess {
  success: true
  sourceLanguage: 'EN'
  targetLanguage: 'VI'
  translatedText: string
}

export interface ReplyTranslationFailure {
  success: false
  error: ReplyTranslationError
}

export type ReplyTranslationResult =
  | ReplyTranslationSuccess
  | ReplyTranslationFailure

function buildReplyTranslationPrompt(content: string): string {
  return [
    'Translate this English tax office SMS draft into natural Vietnamese.',
    'The staff member speaks as "em".',
    'Address the client as "anh/chị" unless the draft clearly chooses "anh" or "chị".',
    'Preserve names, URLs, phone numbers, dollar amounts, dates, tax years, tax form names, and business names exactly.',
    'Keep the message concise and SMS-friendly.',
    'Do not add explanations, markdown, quotes, greetings, facts, or extra details.',
    '',
    'Draft:',
    content,
  ].join('\n')
}

export async function translateReplyToVietnamese(
  content: string
): Promise<ReplyTranslationResult> {
  const trimmed = content.trim()

  if (!trimmed) {
    return { success: false, error: 'EMPTY_MESSAGE' }
  }

  if (content.length > MAX_REPLY_TRANSLATION_CHARS) {
    return { success: false, error: 'MESSAGE_TOO_LONG' }
  }

  if (!isGeminiConfigured) {
    return { success: false, error: 'AI_NOT_CONFIGURED' }
  }

  const result = await generateContent(buildReplyTranslationPrompt(trimmed))

  if (!result.success || !result.data) {
    return { success: false, error: 'TRANSLATION_FAILED' }
  }

  const translatedText = cleanTranslatedText(result.data)
  if (!translatedText) {
    return { success: false, error: 'TRANSLATION_FAILED' }
  }

  return {
    success: true,
    sourceLanguage: 'EN',
    targetLanguage: 'VI',
    translatedText,
  }
}
