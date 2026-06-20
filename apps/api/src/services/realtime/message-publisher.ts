/**
 * Realtime Message Publisher
 * Publishes message events to Supabase Broadcast channels
 * Events are lightweight notifications; frontend fetches full data via API
 */
import { getSupabaseUrl, getSupabaseHeaders, isSupabaseConfigured } from '../../lib/supabase'
import { prisma } from '../../lib/db'

export interface MessageEventPayload {
  eventType?: 'message.created' | 'message.status.updated' | 'conversation.read'
  // Owner is polymorphic: either conversation (Client case) or lead.
  conversationId?: string
  caseId?: string
  leadId?: string
  messageId?: string
  direction?: 'INBOUND' | 'OUTBOUND'
  channel?: 'SMS' | 'PORTAL' | 'SYSTEM' | 'CALL'
  twilioStatus?: string | null
  twilioErrorCode?: string | null
  unreadCount?: number
  readAt?: string
  timestamp: string
}

/**
 * Publish message event to org-scoped Broadcast channel
 * Channel format: org:{orgId}:messages
 */
export async function publishMessageEvent(
  orgId: string,
  payload: MessageEventPayload
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('[Realtime] Supabase not configured, skipping publish')
    return
  }

  const channelName = `org:${orgId}:messages`
  const url = `${getSupabaseUrl()}/realtime/v1/api/broadcast`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        messages: [{ topic: channelName, event: 'message', payload }],
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Realtime] Broadcast failed: ${response.status} ${text}`)
    } else {
      console.log(`[Realtime] Published to ${channelName}: ${payload.messageId ?? payload.eventType ?? 'event'}`)
    }
  } catch (error) {
    // Non-blocking: log but don't throw — realtime should never break message flow
    console.error('[Realtime] Publish error:', error)
  }
}

/**
 * Helper to publish message event with org lookup
 * Resolves orgId from conversationId via database
 */
export async function publishMessageEventFromConversation(
  conversationId: string,
  message: {
    id: string
    direction: 'INBOUND' | 'OUTBOUND'
    channel: 'SMS' | 'PORTAL' | 'SYSTEM' | 'CALL'
    eventType?: MessageEventPayload['eventType']
    twilioStatus?: string | null
    twilioErrorCode?: string | null
  }
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        taxCase: {
          include: {
            client: {
              include: {
                organization: { select: { clerkOrgId: true } },
              },
            },
          },
        },
      },
    })

    const clerkOrgId = conversation?.taxCase?.client?.organization?.clerkOrgId
    if (!clerkOrgId) {
      console.log(`[Realtime] No org found for conversation ${conversationId}`)
      return
    }

    await publishMessageEvent(clerkOrgId, {
      conversationId,
      caseId: conversation.caseId,
      eventType: message.eventType ?? 'message.created',
      messageId: message.id,
      direction: message.direction,
      channel: message.channel,
      twilioStatus: message.twilioStatus,
      twilioErrorCode: message.twilioErrorCode,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Realtime] Failed to publish from conversation:', error)
  }
}

export async function publishConversationReadEvent(
  conversationId: string,
  data: {
    unreadCount: number
    readAt: string
  }
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        taxCase: {
          include: {
            client: {
              include: {
                organization: { select: { clerkOrgId: true } },
              },
            },
          },
        },
      },
    })

    const clerkOrgId = conversation?.taxCase?.client?.organization?.clerkOrgId
    if (!clerkOrgId) {
      console.log(`[Realtime] No org found for conversation ${conversationId}`)
      return
    }

    await publishMessageEvent(clerkOrgId, {
      conversationId,
      caseId: conversation.caseId,
      eventType: 'conversation.read',
      unreadCount: data.unreadCount,
      readAt: data.readAt,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Realtime] Failed to publish conversation read event:', error)
  }
}

/**
 * Publish message event for a Lead-owned message.
 * Resolves orgId (clerkOrgId) from leadId and broadcasts on `org:{orgId}:messages`.
 */
export async function publishMessageEventFromLead(
  leadId: string,
  message: {
    id: string
    direction: 'INBOUND' | 'OUTBOUND'
    channel: 'SMS' | 'PORTAL' | 'SYSTEM' | 'CALL'
  }
): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        organization: { select: { clerkOrgId: true } },
      },
    })

    const clerkOrgId = lead?.organization?.clerkOrgId
    if (!clerkOrgId) {
      console.log(`[Realtime] No org found for lead ${leadId}`)
      return
    }

    await publishMessageEvent(clerkOrgId, {
      leadId,
      eventType: 'message.created',
      messageId: message.id,
      direction: message.direction,
      channel: message.channel,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Realtime] Failed to publish from lead:', error)
  }
}
