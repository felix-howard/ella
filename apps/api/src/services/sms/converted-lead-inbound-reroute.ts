import type { Lead, MessageChannel, MessageDirection, Prisma } from '@ella/db'
import type { LeadMmsMediaResult } from './lead-mms-media-handler'
import type { TwilioIncomingMessage } from './webhook-handler'

export interface ConvertedLeadInboundResult {
  caseId: string
  conversationId: string
  message: {
    id: string
    direction: MessageDirection
    channel: MessageChannel
    isSystem?: boolean | null
  }
}

export async function createConvertedLeadConversationMessage(
  tx: Prisma.TransactionClient,
  input: {
    lead: Lead
    convertedToId: string
    incomingMsg: TwilioIncomingMessage
    content: string
    mediaResult: LeadMmsMediaResult
  }
): Promise<ConvertedLeadInboundResult> {
  const taxCase = await tx.taxCase.findFirst({
    where: {
      clientId: input.convertedToId,
      client: { organizationId: input.lead.organizationId },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!taxCase) {
    throw new Error('Converted lead client has no tax case for inbound message')
  }

  const conversation = await tx.conversation.upsert({
    where: { caseId: taxCase.id },
    update: {},
    create: { caseId: taxCase.id },
  })

  const message = await tx.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'SMS' as MessageChannel,
      direction: 'INBOUND' as MessageDirection,
      content: input.content,
      twilioSid: input.incomingMsg.MessageSid,
      attachmentUrls: input.mediaResult.attachmentUrls,
      attachmentR2Keys: input.mediaResult.attachmentR2Keys,
    },
  })

  await tx.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  })

  const attachmentCount = input.mediaResult.attachmentUrls.length
  await tx.action.create({
    data: {
      caseId: taxCase.id,
      type: 'CLIENT_REPLIED',
      priority: 'NORMAL',
      title: attachmentCount > 0 ? 'Client sent attachments' : 'Client replied',
      description: attachmentCount > 0
        ? `New message with ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`
        : 'New client message',
      metadata: {
        messageId: message.id,
        preview: input.content.trim().slice(0, 100),
        mediaCount: attachmentCount,
        convertedLeadId: input.lead.id,
      },
    },
  })

  return {
    caseId: taxCase.id,
    conversationId: conversation.id,
    message,
  }
}
