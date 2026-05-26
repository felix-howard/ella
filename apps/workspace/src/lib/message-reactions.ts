import type { Message } from './api-client'
import {
  isSameTapbackTarget,
  parseTapbackReaction,
  type MessageReaction,
} from '@ella/shared'

export { parseTapbackReaction, type MessageReaction }

export type MessageWithReactions<T extends BaseMessage = Message> = T & {
  reactions?: MessageReaction[]
}

interface BaseMessage {
  id: string
  channel: Message['channel']
  direction: Message['direction']
  content: string
  createdAt: string
}

export function isTapbackReactionMessage(message: BaseMessage): boolean {
  return message.channel === 'SMS' && message.direction === 'INBOUND' && parseTapbackReaction(message.content) !== null
}

export function buildMessagesWithTapbackReactions<T extends BaseMessage>(
  messages: T[]
): MessageWithReactions<T>[] {
  const displayMessages: MessageWithReactions<T>[] = []
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (const message of sortedMessages) {
    const tapback = message.channel === 'SMS' && message.direction === 'INBOUND'
      ? parseTapbackReaction(message.content)
      : null

    if (tapback) {
      const targetIndex = findTapbackTargetIndex(displayMessages, tapback.quotedText)

      if (targetIndex >= 0) {
        const target = displayMessages[targetIndex]
        displayMessages[targetIndex] = {
          ...target,
          reactions: [
            ...(target.reactions ?? []),
            { id: message.id, type: tapback.type, label: tapback.label },
          ],
        }
        continue
      }
    }

    displayMessages.push({ ...message })
  }

  return displayMessages
}

function findTapbackTargetIndex(messages: BaseMessage[], quotedText: string): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isSameTapbackTarget(messages[index].content, quotedText)) {
      return index
    }
  }

  return -1
}
