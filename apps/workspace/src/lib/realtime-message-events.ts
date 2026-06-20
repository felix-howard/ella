/**
 * Shared Supabase Broadcast subscription for org-scoped message events.
 *
 * Multiple mounted message surfaces need the same event stream. Keeping one
 * channel per org avoids duplicate same-name subscriptions and fans events out
 * to every active listener.
 */
import { getSupabaseClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type MessageChannel = 'SMS' | 'PORTAL' | 'SYSTEM' | 'CALL'

interface BaseMessageEventPayload {
  conversationId?: string
  caseId?: string
  leadId?: string
  timestamp: string
}

interface MessageCreatedEventPayload extends BaseMessageEventPayload {
  eventType?: 'message.created'
  messageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  channel: MessageChannel
}

interface MessageStatusUpdatedEventPayload extends BaseMessageEventPayload {
  eventType: 'message.status.updated'
  messageId: string
  direction: 'INBOUND' | 'OUTBOUND'
  channel: MessageChannel
  twilioStatus: string | null
  twilioErrorCode?: string | null
}

interface ConversationReadEventPayload extends BaseMessageEventPayload {
  eventType: 'conversation.read'
  conversationId: string
  caseId: string
  unreadCount: number
  readAt: string
}

export type MessageEventPayload =
  | MessageCreatedEventPayload
  | MessageStatusUpdatedEventPayload
  | ConversationReadEventPayload

export type MessageEventType = NonNullable<MessageEventPayload['eventType']>
export type MessageEventListener = (data: MessageEventPayload) => void

interface MessageChannelState {
  channel: RealtimeChannel
  listeners: Set<MessageEventListener>
}

const messageChannels = new Map<string, MessageChannelState>()

export function subscribeToRealtimeMessageEvents(
  organizationId: string,
  listener: MessageEventListener
): () => void {
  const supabase = getSupabaseClient()
  if (!supabase) return () => {}

  let state = messageChannels.get(organizationId)

  if (!state) {
    const listeners = new Set<MessageEventListener>()
    const channelName = `org:${organizationId}:messages`
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'message' }, (payload) => {
        const data = payload.payload as MessageEventPayload

        if (import.meta.env.DEV) {
          console.log('[Realtime] Message event received:', data)
        }

        listeners.forEach((currentListener) => {
          currentListener(data)
        })
      })
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[Realtime] Channel ${channelName} status:`, status)
        }
      })

    state = { channel, listeners }
    messageChannels.set(organizationId, state)
  }

  state.listeners.add(listener)

  return () => {
    const currentState = messageChannels.get(organizationId)
    if (!currentState) return

    currentState.listeners.delete(listener)
    if (currentState.listeners.size > 0) return

    supabase.removeChannel(currentState.channel)
    messageChannels.delete(organizationId)
  }
}
