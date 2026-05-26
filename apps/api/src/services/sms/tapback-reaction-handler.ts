import { prisma } from '../../lib/db'
import {
  isSameTapbackTarget,
  parseTapbackReaction,
  type MessageReaction,
} from '@ella/shared'
import type { Prisma } from '@ella/db'

interface ProcessTapbackReactionInput {
  conversationId: string
  content: string
  twilioSid?: string
  createdAt?: Date
}

interface ProcessTapbackReactionResult {
  targetMessageId: string
  duplicate: boolean
}

export async function processTapbackReaction({
  conversationId,
  content,
  twilioSid,
  createdAt = new Date(),
}: ProcessTapbackReactionInput): Promise<ProcessTapbackReactionResult | null> {
  const tapback = parseTapbackReaction(content)
  if (!tapback) return null

  const candidates = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      content: true,
      reactions: true,
    },
  })

  const target = candidates.find((message) =>
    !parseTapbackReaction(message.content) &&
    isSameTapbackTarget(message.content, tapback.quotedText)
  )
  if (!target) return null

  const reactions = coerceReactions(target.reactions)
  if (twilioSid && reactions.some((reaction) => reaction.twilioSid === twilioSid)) {
    return { targetMessageId: target.id, duplicate: true }
  }

  const nextReactions: MessageReaction[] = [
    ...reactions,
    {
      id: twilioSid || `tapback-${createdAt.getTime()}`,
      type: tapback.type,
      label: tapback.label,
      createdAt: createdAt.toISOString(),
      twilioSid: twilioSid || null,
    },
  ]

  await prisma.message.update({
    where: { id: target.id },
    data: {
      reactions: nextReactions as unknown as Prisma.InputJsonValue,
    },
  })

  return { targetMessageId: target.id, duplicate: false }
}

function coerceReactions(value: unknown): MessageReaction[] {
  if (!Array.isArray(value)) return []

  return value.filter((reaction): reaction is MessageReaction => (
    typeof reaction === 'object' &&
    reaction !== null &&
    'id' in reaction &&
    'type' in reaction &&
    'label' in reaction &&
    typeof reaction.id === 'string' &&
    reaction.type === 'love' &&
    typeof reaction.label === 'string'
  ))
}
