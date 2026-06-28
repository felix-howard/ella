import type { Prisma } from '@ella/db'
import type { LeadMmsMediaResult } from './lead-mms-media-handler'

function buildLeadReplyActionData(input: {
  leadId: string
  messageId: string
  messageCreatedAt: Date
  content: string
  mediaResult: LeadMmsMediaResult
  unreadCount: number
}) {
  const attachmentCount = input.mediaResult.attachmentUrls.length
  const hasAttachment = attachmentCount > 0

  return {
    priority: 'HIGH' as const,
    title: 'Lead replied',
    description: hasAttachment
      ? `New lead reply with ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`
      : 'New lead reply',
    metadata: {
      leadId: input.leadId,
      messageId: input.messageId,
      lastMessageAt: input.messageCreatedAt.toISOString(),
      unreadCount: input.unreadCount,
      hasAttachment,
      mediaCount: attachmentCount,
      mediaErrorCount: input.mediaResult.errors.length,
    },
  }
}

export async function acquireLeadReplyActionLock(tx: Prisma.TransactionClient, leadId: string) {
  // Serialize first-reply coalescing per lead. Without this, concurrent Twilio
  // webhooks can both observe no incomplete action and create duplicates.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('ella_lead_reply_action'), hashtext(${leadId}))
  `
}

export async function coalesceLeadReplyAction(
  tx: Prisma.TransactionClient,
  input: {
    leadId: string
    messageId: string
    messageCreatedAt: Date
    content: string
    mediaResult: LeadMmsMediaResult
    unreadCount: number
  }
) {
  await acquireLeadReplyActionLock(tx, input.leadId)

  const actionData = buildLeadReplyActionData(input)
  const existing = await tx.action.findFirst({
    where: {
      leadId: input.leadId,
      type: 'LEAD_REPLIED',
      isCompleted: false,
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (existing) {
    await tx.action.update({
      where: { id: existing.id },
      data: actionData,
    })
    return
  }

  await tx.action.create({
    data: {
      leadId: input.leadId,
      type: 'LEAD_REPLIED',
      ...actionData,
    },
  })
}
