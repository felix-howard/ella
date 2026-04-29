/**
 * useChatUnread - Unread message count for a ChatContext.
 * Routes to the correct endpoint based on context type.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import type { ChatContext } from '../types/chat-context'
import { chatContextId } from '../types/chat-context'

export interface UseChatUnreadResult {
  unreadCount: number
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

interface UnreadResult {
  unreadCount: number
}

async function fetchUnread(context: ChatContext): Promise<UnreadResult> {
  if (context.type === 'case') {
    const res = await api.messages.getUnreadCount(context.caseId)
    return { unreadCount: res.unreadCount }
  }
  const res = await api.leads.messages.getUnread(context.leadId)
  return { unreadCount: res.unreadCount }
}

export function useChatUnread(context: ChatContext, enabled = true): UseChatUnreadResult {
  const id = chatContextId(context)
  const query = useQuery<UnreadResult>({
    queryKey: ['unread-count', context.type, id],
    queryFn: () => fetchUnread(context),
    enabled: enabled && !!id,
    staleTime: 30000,
  })

  return {
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      query.refetch()
    },
  }
}
