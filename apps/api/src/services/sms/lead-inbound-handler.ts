import { ActivityRiskLevel, type Lead, type MessageChannel, type MessageDirection } from '@ella/db'
import { prisma } from '../../lib/db'
import { logSystemActivity } from '../activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../activity-actions'
import {
  publishMessageEventFromConversation,
  publishMessageEventFromLead,
} from '../realtime/message-publisher'
import { notifyClientMessagePushFromConversation, notifyLeadMessagePushFromLead } from '../web-push'
import {
  createConvertedLeadConversationMessage,
  type ConvertedLeadInboundResult,
} from './converted-lead-inbound-reroute'
import { processLeadMmsMedia, type LeadMmsMediaResult } from './lead-mms-media-handler'
import { acquireLeadReplyActionLock, coalesceLeadReplyAction } from './lead-reply-action-service'
import type { TwilioIncomingMessage } from './webhook-handler'

export interface LeadInboundResult {
  success: boolean
  messageId?: string
  caseId?: string
  leadId?: string
  actionCreated?: boolean
  error?: string
}

type PersistedInboundMessage =
  | {
      owner: 'lead'
      message: {
        id: string
        createdAt: Date
        direction: MessageDirection
        channel: MessageChannel
        isSystem?: boolean | null
      }
    }
  | {
      owner: 'conversation'
    } & ConvertedLeadInboundResult

/**
 * Find a Lead matching an inbound phone number.
 * Tries multiple phone formats (raw, E.164, digits-only) to tolerate storage variance.
 * Excludes CONVERTED leads — those are now clients and should take the client flow.
 * Returns most recently updated match to break ties across orgs.
 */
export async function findLeadByPhone(fromPhone: string, organizationId?: string): Promise<Lead | null> {
  const digits = fromPhone.replace(/\D/g, '')
  const normalized =
    digits.startsWith('1') && digits.length === 11 ? digits.substring(1) : digits
  const e164 = '+1' + normalized

  return await prisma.lead.findFirst({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: { not: 'CONVERTED' },
      OR: [
        { phone: fromPhone },
        { phone: e164 },
        { phone: normalized },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function logLeadMessageReceivedActivity(
  lead: Lead,
  messageId: string,
  mediaResult: LeadMmsMediaResult
) {
  await logSystemActivity({
    organizationId: lead.organizationId,
    category: ACTIVITY_CATEGORIES.LEAD,
    targetType: ACTIVITY_TARGET_TYPES.MESSAGE,
    targetId: messageId,
    summary: 'Received lead message',
    action: ACTIVITY_ACTIONS.LEAD.MESSAGE_RECEIVED,
    riskLevel: ActivityRiskLevel.LOW,
    metadata: {
      leadId: lead.id,
      messageId,
      hasAttachment: mediaResult.attachmentUrls.length > 0,
      attachmentCount: mediaResult.attachmentUrls.length,
      mediaErrorCount: mediaResult.errors.length,
    },
  })
}

/**
 * Process inbound SMS/MMS routed to a Lead.
 * Assumes caller has already performed twilioSid idempotency check.
 */
export async function processLeadInbound(
  lead: Lead,
  incomingMsg: TwilioIncomingMessage,
  content: string,
): Promise<LeadInboundResult> {
  const mediaResult = await processLeadMmsMedia(incomingMsg, lead)

  const persisted = await prisma.$transaction(async (tx): Promise<PersistedInboundMessage> => {
    await acquireLeadReplyActionLock(tx, lead.id)

    const currentLead = await tx.lead.findUnique({
      where: { id: lead.id },
      select: {
        status: true,
        convertedToId: true,
      },
    })

    if (currentLead?.status === 'CONVERTED' && currentLead.convertedToId) {
      const converted = await createConvertedLeadConversationMessage(tx, {
        lead,
        convertedToId: currentLead.convertedToId,
        incomingMsg,
        content,
        mediaResult,
      })
      return { owner: 'conversation', ...converted }
    }

    const createdMessage = await tx.message.create({
      data: {
        leadId: lead.id,
        channel: 'SMS' as MessageChannel,
        direction: 'INBOUND' as MessageDirection,
        content,
        twilioSid: incomingMsg.MessageSid,
        attachmentUrls: mediaResult.attachmentUrls,
        attachmentR2Keys: mediaResult.attachmentR2Keys,
      },
    })

    if (lead.status === 'NEW' || lead.status === 'SENT') {
      await tx.lead.updateMany({
        where: {
          id: lead.id,
          status: { in: ['NEW', 'SENT'] },
        },
        data: { status: 'CONTACTED' },
      })
    }

    const unreadCount = await tx.message.count({
      where: {
        leadId: lead.id,
        direction: 'INBOUND',
        ...(lead.messagesLastReadAt
          ? { createdAt: { gt: lead.messagesLastReadAt } }
          : {}),
      },
    })

    await coalesceLeadReplyAction(tx, {
      leadId: lead.id,
      messageId: createdMessage.id,
      messageCreatedAt: createdMessage.createdAt,
      content,
      mediaResult,
      unreadCount,
    })

    return {
      owner: 'lead',
      message: createdMessage,
    }
  })

  if (persisted.owner === 'conversation') {
    publishMessageEventFromConversation(persisted.conversationId, {
      id: persisted.message.id,
      direction: 'INBOUND',
      channel: 'SMS',
    }).catch(() => {})
    notifyClientMessagePushFromConversation(persisted.conversationId, persisted.message).catch(() => {})
    console.log(`[LeadInbound] Converted lead reply ${persisted.message.id} recorded for case ${persisted.caseId}`)
    return {
      success: true,
      messageId: persisted.message.id,
      caseId: persisted.caseId,
      actionCreated: true,
    }
  }

  publishMessageEventFromLead(lead.id, {
    id: persisted.message.id,
    direction: 'INBOUND',
    channel: 'SMS',
  }).catch(() => {})
  notifyLeadMessagePushFromLead(lead.id, persisted.message).catch(() => {})
  await logLeadMessageReceivedActivity(lead, persisted.message.id, mediaResult)

  console.log(`[LeadInbound] Message ${persisted.message.id} recorded for lead ${lead.id}`)

  return { success: true, messageId: persisted.message.id, leadId: lead.id, actionCreated: true }
}
