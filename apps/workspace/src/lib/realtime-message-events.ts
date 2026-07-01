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

interface LeadReadEventPayload extends BaseMessageEventPayload {
  eventType: 'lead.read'
  leadId: string
  unreadCount: number
  readAt: string
}

export type MessageEventPayload =
  | MessageCreatedEventPayload
  | MessageStatusUpdatedEventPayload
  | ConversationReadEventPayload
  | LeadReadEventPayload

export type MessageEventType = NonNullable<MessageEventPayload['eventType']>
export type MessageEventListener = (data: MessageEventPayload) => void

interface MessageChannelState {
  channel: RealtimeChannel
  listeners: Set<MessageEventListener>
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

const messageChannels = new Map<string, MessageChannelState>()
const CHANNEL_CLEANUP_DELAY_MS = 1000
const MESSAGE_DEBUG_STORAGE_KEY = 'ella:debug:messages'

export function isMessageRealtimeDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MESSAGE_DEBUG_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function logMessageRealtimeDebug(
  event: string,
  data: Record<string, unknown> = {}
): void {
  if (!isMessageRealtimeDebugEnabled()) return
  console.log(`[EllaMessagesDebug] ${event}`, {
    at: new Date().toISOString(),
    ...data,
  })
}

function getMessageId(data: MessageEventPayload): string | undefined {
  return 'messageId' in data ? data.messageId : undefined
}

function getMessageDirection(data: MessageEventPayload): string | undefined {
  return 'direction' in data ? data.direction : undefined
}

export function subscribeToRealtimeMessageEvents(
  organizationId: string,
  listener: MessageEventListener
): () => void {
  const supabase = getSupabaseClient()
  if (!supabase) {
    logMessageRealtimeDebug('channel.missing-client', { organizationId })
    return () => {}
  }

  let state = messageChannels.get(organizationId)

  if (!state) {
    const listeners = new Set<MessageEventListener>()
    const channelName = `org:${organizationId}:messages`
    logMessageRealtimeDebug('channel.create', { channelName, organizationId })
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'message' }, (payload) => {
        const data = payload.payload as MessageEventPayload

        logMessageRealtimeDebug('channel.event.raw', {
          organizationId,
          eventType: data.eventType ?? 'message.created',
          caseId: data.caseId,
          leadId: data.leadId,
          messageId: getMessageId(data),
          direction: getMessageDirection(data),
          listenerCount: listeners.size,
        })

        listeners.forEach((currentListener) => {
          currentListener(data)
        })
      })
      .subscribe((status) => {
        logMessageRealtimeDebug('channel.status', { channelName, status })
      })

    state = { channel, listeners, cleanupTimer: null }
    messageChannels.set(organizationId, state)
  } else if (state.cleanupTimer) {
    clearTimeout(state.cleanupTimer)
    state.cleanupTimer = null
  }

  state.listeners.add(listener)
  logMessageRealtimeDebug('channel.listener.add', {
    organizationId,
    listenerCount: state.listeners.size,
  })

  return () => {
    const currentState = messageChannels.get(organizationId)
    if (!currentState) return

    currentState.listeners.delete(listener)
    logMessageRealtimeDebug('channel.listener.remove', {
      organizationId,
      listenerCount: currentState.listeners.size,
    })
    if (currentState.listeners.size > 0) return

    currentState.cleanupTimer = setTimeout(() => {
      const latestState = messageChannels.get(organizationId)
      if (!latestState || latestState !== currentState || latestState.listeners.size > 0) return

      logMessageRealtimeDebug('channel.remove', { organizationId })
      supabase.removeChannel(latestState.channel)
      messageChannels.delete(organizationId)
    }, CHANNEL_CLEANUP_DELAY_MS)
  }
}
