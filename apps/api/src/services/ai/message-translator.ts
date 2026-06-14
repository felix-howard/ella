import { generateContent, isGeminiConfigured } from './gemini-client'

const MAX_MESSAGE_TRANSLATION_CHARS = 5000

export type MessageTranslationError =
  | 'AI_NOT_CONFIGURED'
  | 'EMPTY_MESSAGE'
  | 'TRANSLATION_FAILED'

export interface MessageTranslationSuccess {
  success: true
  sourceLanguage: 'unknown'
  targetLanguage: 'EN'
  translatedText: string
}

export interface MessageTranslationFailure {
  success: false
  error: MessageTranslationError
}

export type MessageTranslationResult =
  | MessageTranslationSuccess
  | MessageTranslationFailure

function buildTranslationPrompt(content: string): string {
  return [
    'Translate this Vietnamese chat message to natural English.',
    'If it is already English, return the original meaning in polished English without inventing details.',
    'Preserve names, phone numbers, dates, links, dollar amounts, tax form names, tax years, and business names exactly.',
    'Preserve line breaks when helpful.',
    'Do not add explanation, preface, markdown, or quotes.',
    '',
    'Message:',
    content,
  ].join('\n')
}

export function cleanTranslatedText(text: string): string {
  let cleaned = text.trim()

  const matchingQuotes = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
  ] as const

  for (const [open, close] of matchingQuotes) {
    if (cleaned.startsWith(open) && cleaned.endsWith(close)) {
      cleaned = cleaned.slice(open.length, -close.length).trim()
      break
    }
  }

  return cleaned
}

export async function translateMessageToEnglish(
  content: string
): Promise<MessageTranslationResult> {
  const trimmed = content.trim()

  if (!trimmed) {
    return { success: false, error: 'EMPTY_MESSAGE' }
  }

  if (!isGeminiConfigured) {
    return { success: false, error: 'AI_NOT_CONFIGURED' }
  }

  const promptInput = trimmed.slice(0, MAX_MESSAGE_TRANSLATION_CHARS)
  const result = await generateContent(buildTranslationPrompt(promptInput))

  if (!result.success || !result.data) {
    return { success: false, error: 'TRANSLATION_FAILED' }
  }

  const translatedText = cleanTranslatedText(result.data)
  if (!translatedText) {
    return { success: false, error: 'TRANSLATION_FAILED' }
  }

  return {
    success: true,
    sourceLanguage: 'unknown',
    targetLanguage: 'EN',
    translatedText,
  }
}
