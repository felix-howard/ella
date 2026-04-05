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

interface MessageEventPayload {
  conversationId: string
  caseId: string
  messageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  channel: 'SMS' | 'PORTAL' | 'CALL'
  timestamp: string
}

interface UseRealtimeMessagesOptions {
  /** Only invalidate for specific caseId */
  caseId?: string
  /** Enable/disable subscription (default: true) */
  enabled?: boolean
  /** Callback when a message event is received (for manual-fetch components) */
  onEvent?: (data: MessageEventPayload) => void
}

/**
 * Subscribe to realtime message events for current organization
 * On event: invalidates React Query caches + calls onEvent callback
 */
export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { caseId, enabled = true, onEvent } = options
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

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

        // If caseId filter provided, only process matching case
        if (caseId && data.caseId !== caseId) {
          return
        }

        // Invalidate React Query caches (for components using useQuery)
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        queryClient.invalidateQueries({ queryKey: ['unread-count'] })
        queryClient.invalidateQueries({ queryKey: ['messages', data.caseId] })

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
  }, [enabled, organization?.id, caseId, queryClient])
}
