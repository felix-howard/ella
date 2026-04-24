/**
 * useRealtimeMessages - Subscribe to org message events
 * Invalidates React Query cache + calls optional onEvent callback
 * Gracefully degrades when Supabase not configured
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@clerk/clerk-react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatContext } from '../types/chat-context'

interface MessageEventPayload {
  // Polymorphic owner: one of conversationId/caseId (client case) or leadId (lead).
  conversationId?: string
  caseId?: string
  leadId?: string
  messageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  channel: 'SMS' | 'PORTAL' | 'CALL'
  timestamp: string
}

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

/**
 * Subscribe to realtime message events for current organization
 * On event: invalidates React Query caches + calls onEvent callback
 */
export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { context, caseId, enabled = true, onEvent } = options
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

  const contextType = context?.type
  const contextId = context ? (context.type === 'case' ? context.caseId : context.leadId) : undefined

  useEffect(() => {
    if (!enabled || !organization?.id || !isSupabaseConfigured()) {
      return
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return
    }

    const channelName = `org:${organization.id}:messages`

    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'message' }, (payload) => {
        const data = payload.payload as MessageEventPayload

        if (import.meta.env.DEV) {
          console.log('[Realtime] Message event received:', data)
        }

        // Apply filters: prefer new `context`; fall back to legacy `caseId`.
        if (context) {
          if (!matchesContext(context, data)) return
        } else if (caseId && data.caseId !== caseId) {
          return
        }

        // Invalidate shared caches
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
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[Realtime] Channel ${channelName} status:`, status)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // context is stable when derived from callers; we depend on its scalar parts
    // to avoid resubscription churn from object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organization?.id, contextType, contextId, caseId, queryClient])
}
