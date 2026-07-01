import type { MessageChannel, MessageDirection } from '@ella/db'
import { sendWebPushToStaff } from './push-delivery-service'
import type { WebPushDeliveryResult } from './push-delivery-types'
import { buildLeadMessagePushPayload } from './push-payloads'
import { resolveLeadMessagePushRecipients } from './recipient-resolver'

type LeadMessagePushMessage = {
  id: string
  direction: MessageDirection
  channel: MessageChannel
  isSystem?: boolean | null
}

function isLeadMessagePushEligible(message: LeadMessagePushMessage): boolean {
  return (
    message.direction === 'INBOUND' &&
    message.channel === 'SMS' &&
    message.isSystem !== true
  )
}

function logIncompleteDelivery(
  leadId: string,
  messageId: string,
  result: WebPushDeliveryResult
) {
  if (!result.skippedReason && result.failed === 0 && result.disabled === 0) return

  const failureStatusCodes = [
    ...new Set(result.failures.map((failure) => failure.statusCode).filter(Boolean)),
  ]

  console.warn('[WebPush] Lead message delivery incomplete', {
    leadId,
    messageId,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    disabled: result.disabled,
    ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
    ...(failureStatusCodes.length > 0 ? { failureStatusCodes } : {}),
  })
}

export async function notifyLeadMessagePushFromLead(
  leadId: string,
  message: LeadMessagePushMessage
): Promise<WebPushDeliveryResult | null> {
  if (!isLeadMessagePushEligible(message)) return null

  try {
    const recipients = await resolveLeadMessagePushRecipients(leadId)
    if (!recipients) return null

    const result = await sendWebPushToStaff({
      organizationId: recipients.organizationId,
      staffIds: recipients.staffIds,
      payload: buildLeadMessagePushPayload(recipients.leadId),
    })
    logIncompleteDelivery(leadId, message.id, result)
    return result
  } catch (error) {
    console.warn('[WebPush] Lead message notification failed', {
      leadId,
      messageId: message.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return null
  }
}
