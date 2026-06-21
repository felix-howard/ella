/**
 * useRealtimeMessages - Subscribe to org message events
 * Invalidates React Query cache + calls optional onEvent callback
 * Gracefully degrades when Supabase not configured
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@clerk/clerk-react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  logMessageRealtimeDebug,
  subscribeToRealtimeMessageEvents,
  type MessageEventPayload,
  type MessageEventType,
} from '../lib/realtime-message-events'
import type { ChatContext } from '../types/chat-context'
import type { Conversation } from '../lib/api-client'

export type { MessageEventPayload, MessageEventType } from '../lib/realtime-message-events'

interface UseRealtimeMessagesOptions {
  /** Filter events to a specific chat context (case or lead). */
  context?: ChatContext
  /**
   * @deprecated Pass `context: { type: 'case', caseId, clientId }` instead.
   * Retained for callers that only care about case-scoped filtering.
   */
  caseId?: string
  /** Enable/disable subscription (default: true) */
  enabled?: boolean
  /** Callback when a message event is received (for manual-fetch components) */
  onEvent?: (data: MessageEventPayload) => void
}

function matchesContext(ctx: ChatContext | undefined, data: MessageEventPayload): boolean {
  if (!ctx) return true
  if (ctx.type === 'case') return data.caseId === ctx.caseId
  return data.leadId === ctx.leadId
}

export function getMessageEventType(data: MessageEventPayload): MessageEventType {
  return data.eventType ?? 'message.created'
}

export function subtractUnreadCount(current: number | undefined, count: number): number {
  return Math.max(0, (current ?? 0) - Math.max(0, count))
}

export function adjustUnreadCount(
  current: number | undefined,
  previousCount: number,
  nextCount: number
): number {
  return Math.max(0, (current ?? 0) - Math.max(0, previousCount) + Math.max(0, nextCount))
}

export function getConversationUnreadPatch(
  conversations: Conversation[],
  caseId: string,
  nextUnreadCount: number
): {
  conversations: Conversation[]
  previousUnreadCount: number
  nextUnreadCount: number
  changed: boolean
} {
  const previousUnreadCount = conversations.find((conversation) => conversation.caseId === caseId)?.unreadCount ?? 0
  const safeNextUnreadCount = Math.max(0, nextUnreadCount)

  if (previousUnreadCount === safeNextUnreadCount) {
    return {
      conversations,
      previousUnreadCount,
      nextUnreadCount: safeNextUnreadCount,
      changed: false,
    }
  }

  return {
    conversations: conversations.map((conversation) =>
      conversation.caseId === caseId ? { ...conversation, unreadCount: safeNextUnreadCount } : conversation
    ),
    previousUnreadCount,
    nextUnreadCount: safeNextUnreadCount,
    changed: true,
  }
}

/**
 * Subscribe to realtime message events for current organization
 * On event: invalidates React Query caches + calls onEvent callback
 */
export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { context, caseId, enabled = true, onEvent } = options
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

  const contextType = context?.type
  const contextId = context ? (context.type === 'case' ? context.caseId : context.leadId) : undefined

  useEffect(() => {
    const configured = isSupabaseConfigured()
    if (!enabled || !organization?.id || !configured) {
      logMessageRealtimeDebug('hook.skip', {
        enabled,
        hasOrganization: Boolean(organization?.id),
        configured,
        contextType,
        contextId,
        caseId,
      })
      return
    }

    logMessageRealtimeDebug('hook.subscribe', {
      organizationId: organization.id,
      contextType,
      contextId,
      caseId,
    })

    return subscribeToRealtimeMessageEvents(organization.id, (data) => {
      logMessageRealtimeDebug('hook.event.received', {
        eventType: getMessageEventType(data),
        eventCaseId: data.caseId,
        eventLeadId: data.leadId,
        contextType,
        contextId,
        caseId,
      })

      // Apply filters: prefer new `context`; fall back to legacy `caseId`.
      if (context) {
        if (!matchesContext(context, data)) {
          logMessageRealtimeDebug('hook.event.filtered', {
            reason: 'context-mismatch',
            eventCaseId: data.caseId,
            eventLeadId: data.leadId,
            contextType,
            contextId,
          })
          return
        }
      } else if (caseId && data.caseId !== caseId) {
        logMessageRealtimeDebug('hook.event.filtered', {
          reason: 'case-mismatch',
          eventCaseId: data.caseId,
          caseId,
        })
        return
      }

      logMessageRealtimeDebug('hook.event.accepted', {
        eventType: getMessageEventType(data),
        eventCaseId: data.caseId,
        eventLeadId: data.leadId,
        contextType,
        contextId,
        caseId,
      })

      // Invalidate shared caches for server reconciliation.
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })

      // Invalidate scoped message-list caches for whichever owner published.
      if (data.caseId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'case', data.caseId] })
      }
      if (data.leadId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'lead', data.leadId] })
      }

      // Call onEvent callback (for manual-fetch components)
      onEventRef.current?.(data)
    })
    // context is stable when derived from callers; we depend on its scalar parts
    // to avoid resubscription churn from object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organization?.id, contextType, contextId, caseId, queryClient])
}
