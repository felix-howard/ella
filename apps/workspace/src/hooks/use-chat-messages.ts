/**
 * useChatMessages - Fetch message thread for a ChatContext (case or lead).
 * Switches API endpoint + query key based on context type.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import type { ChatContext } from '../types/chat-context'
import { chatContextId } from '../types/chat-context'
import type { Message, MessagesResponse } from '../lib/api-client'

// Fallback polling (realtime handles instant updates).
const FALLBACK_POLLING_MS = 60000

export interface UseChatMessagesResult {
  messages: Message[]
  conversation: MessagesResponse['conversation'] | null
  isLoading: boolean
  isError: boolean
}

export function useChatMessages(context: ChatContext, enabled: boolean): UseChatMessagesResult {
  const queryKey = ['messages', context.type, chatContextId(context)] as const

  const query = useQuery({
    queryKey,
    queryFn: () =>
      context.type === 'case'
        ? api.messages.list(context.caseId)
        : api.leads.messages.listLatest(context.leadId),
    enabled: enabled && !!chatContextId(context),
    refetchInterval: enabled ? FALLBACK_POLLING_MS : false,
  })
  const caseResponse = context.type === 'case'
    ? query.data as MessagesResponse | undefined
    : undefined

  return {
    messages: query.data?.messages ?? [],
    conversation: caseResponse?.conversation ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
