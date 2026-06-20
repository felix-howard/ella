import type { Message } from './api-client'

export const OPTIMISTIC_MATCH_WINDOW_MS = 60000
export const SERVER_CLOCK_SKEW_MS = 5000

export type OptimisticMessage = Message & {
  _optimistic?: 'sending' | 'failed'
  _attachmentFiles?: File[]
}

export function isLikelyServerCopy(optimistic: OptimisticMessage, message: Message): boolean {
  if (!optimistic.id.startsWith('temp-') || message.id.startsWith('temp-')) return false
  if (message.direction !== optimistic.direction || message.channel !== optimistic.channel) return false
  if (message.content !== optimistic.content) return false

  const optimisticAttachmentCount = optimistic.attachmentUrls?.length ?? 0
  const messageAttachmentCount = message.attachmentUrls?.length ?? 0
  if (optimisticAttachmentCount !== messageAttachmentCount) return false

  const optimisticTime = new Date(optimistic.createdAt).getTime()
  const messageTime = new Date(message.createdAt).getTime()
  return (
    messageTime >= optimisticTime - SERVER_CLOCK_SKEW_MS
    && messageTime <= optimisticTime + OPTIMISTIC_MATCH_WINDOW_MS
  )
}

export function dedupeMessagesById(messages: OptimisticMessage[]): OptimisticMessage[] {
  return Array.from(new Map(messages.map((message) => [message.id, message])).values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function mergeFetchedMessages(
  previousMessages: OptimisticMessage[],
  fetchedMessages: Message[],
  revokeOptimisticPreviewUrls: (urls?: string[]) => void
): OptimisticMessage[] {
  const messageMap = new Map(fetchedMessages.map((message) => [message.id, message]))
  const matchedServerMessageIds = new Set<string>()
  const existingServerMessageIds = new Set(
    previousMessages
      .filter((message) => !message.id.startsWith('temp-'))
      .map((message) => message.id)
  )

  for (const optimisticMessage of previousMessages.filter((message) => message.id.startsWith('temp-'))) {
    if (optimisticMessage._optimistic === 'sending' || optimisticMessage._optimistic === 'failed') {
      const serverCopy = fetchedMessages.find((message) =>
        !existingServerMessageIds.has(message.id)
        && !matchedServerMessageIds.has(message.id)
        && isLikelyServerCopy(optimisticMessage, message)
      )

      if (serverCopy) {
        matchedServerMessageIds.add(serverCopy.id)
        revokeOptimisticPreviewUrls(optimisticMessage.attachmentUrls)
        continue
      }
    }

    messageMap.set(optimisticMessage.id, optimisticMessage)
  }

  return Array.from(messageMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}
