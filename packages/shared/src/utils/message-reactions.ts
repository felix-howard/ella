export type MessageReactionType = 'love'

export interface MessageReaction {
  id: string
  type: MessageReactionType
  label: string
  createdAt?: string
  twilioSid?: string | null
}

export interface ParsedTapbackReaction {
  type: MessageReactionType
  label: string
  quotedText: string
}

const TAPBACK_REACTION_PATTERN = /^Loved\s+["“](?<quotedText>[\s\S]+)["”]$/i

export function parseTapbackReaction(content: string): ParsedTapbackReaction | null {
  const match = content.trim().match(TAPBACK_REACTION_PATTERN)
  const quotedText = match?.groups?.quotedText?.trim()

  if (!quotedText) return null

  return {
    type: 'love',
    label: 'Loved',
    quotedText,
  }
}

export function isSameTapbackTarget(content: string, quotedText: string): boolean {
  const normalizedContent = normalizeTapbackText(content)
  const normalizedQuote = normalizeTapbackText(quotedText)

  if (!normalizedContent || !normalizedQuote) return false
  if (normalizedContent === normalizedQuote) return true

  const shortestLength = Math.min(normalizedContent.length, normalizedQuote.length)
  if (shortestLength < 20) return false

  return normalizedContent.startsWith(normalizedQuote) || normalizedQuote.startsWith(normalizedContent)
}

function normalizeTapbackText(value: string): string {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
