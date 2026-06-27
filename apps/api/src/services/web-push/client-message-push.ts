import type { MessageChannel, MessageDirection } from '@ella/db'
import { sendWebPushToStaff } from './push-delivery-service'
import type { WebPushDeliveryResult } from './push-delivery-types'
import { buildClientMessagePushPayload } from './push-payloads'
import { resolveClientMessagePushRecipients } from './recipient-resolver'

type ClientMessagePushMessage = {
  id: string
  direction: MessageDirection
  channel: MessageChannel
  isSystem?: boolean | null
}

function isClientMessagePushEligible(message: ClientMessagePushMessage): boolean {
  return (
    message.direction === 'INBOUND' &&
    (message.channel === 'SMS' || message.channel === 'PORTAL') &&
    message.isSystem !== true
  )
}

function logIncompleteDelivery(
  conversationId: string,
  messageId: string,
  result: WebPushDeliveryResult
) {
  if (!result.skippedReason && result.failed === 0 && result.disabled === 0) return

  const failureStatusCodes = [
    ...new Set(result.failures.map((failure) => failure.statusCode).filter(Boolean)),
  ]

  console.warn('[WebPush] Client message delivery incomplete', {
    conversationId,
    messageId,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    disabled: result.disabled,
    ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
    ...(failureStatusCodes.length > 0 ? { failureStatusCodes } : {}),
  })
}

export async function notifyClientMessagePushFromConversation(
  conversationId: string,
  message: ClientMessagePushMessage
): Promise<WebPushDeliveryResult | null> {
  if (!isClientMessagePushEligible(message)) return null

  try {
    const recipients = await resolveClientMessagePushRecipients(conversationId)
    if (!recipients) return null

    const result = await sendWebPushToStaff({
      organizationId: recipients.organizationId,
      staffIds: recipients.staffIds,
      payload: buildClientMessagePushPayload(recipients.caseId),
    })
    logIncompleteDelivery(conversationId, message.id, result)
    return result
  } catch (error) {
    console.warn('[WebPush] Client message notification failed', {
      conversationId,
      messageId: message.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return null
  }
}
