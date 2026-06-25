/**
 * SMS concerns for agreement invites — kept separate from the main service so
 * the template can evolve (EN/VI, copy tweaks) without touching CRUD logic.
 *
 * Lead path (sendAgreementInviteSms): persists Message via Message.leadId and
 * records SmsSendLog audit, then broadcasts a realtime event. Both successes
 * AND failures persist the Message (failures with twilioStatus `ERROR: ...`)
 * so the chat panel surfaces the attempt — mirrors the client path.
 *
 * Client path (sendAgreementInviteSmsForClient): persists Message via the
 * client's latest TaxCase Conversation (Message.conversationId), so chat
 * panels show the invite — successes AND failures (failures land with
 * twilioStatus `ERROR: ...`, mirroring services/sms/message-sender.ts).
 * SmsSendLog is still skipped on this branch because that model's `leadId`
 * is NOT NULL; Twilio's own log remains the audit source for client SMS until
 * schema parity. If the client has no TaxCase, persistence is skipped with a
 * warn (rare — agreements are normally sent after a case exists).
 *
 * v1: language hardcoded to EN. A VI translation is available in the template
 * module for future per-recipient/per-org language resolution.
 *
 * Phase 08: copy is type-agnostic — the agreement title and org name are
 * interpolated so the same template serves NDA, Engagement Letter, Service
 * Agreement, and Custom sends.
 */
import { prisma } from '../../lib/db'
import { sendSmsOnly, isTwilioConfigured } from '../sms'
import {
  generateAgreementInviteMessage,
  AGREEMENT_INVITE_TEMPLATE_NAME,
} from '../sms/templates'
import {
  publishMessageEventFromLead,
  publishMessageEventFromConversation,
} from '../realtime/message-publisher'

export interface RecipientForInvite {
  id: string
  firstName: string
  phone: string
}

export function buildInviteMessage(
  recipient: { firstName: string },
  url: string,
  title: string,
  orgName: string,
): string {
  return generateAgreementInviteMessage({
    firstName: recipient.firstName,
    title,
    orgName,
    url,
    language: 'EN',
  })
}

async function persistAgreementSms(params: {
  leadId: string
  organizationId: string
  sentById: string
  message: string
  ok: boolean
  sid: string | null
  error: string | null
  twilioStatus: string
}): Promise<{ messageId: string | null }> {
  // Persist to Message (chat history) + SmsSendLog (audit) atomically. Failed
  // sends ALSO land in Message (twilioStatus `ERROR: ...`) so the chat panel
  // shows the attempt — message-bubble parses the prefix and renders "Failed".
  const [msg] = await prisma.$transaction([
    prisma.message.create({
      data: {
        leadId: params.leadId,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: params.message,
        twilioSid: params.sid,
        twilioStatus: params.twilioStatus,
        sentById: params.sentById,
        templateUsed: AGREEMENT_INVITE_TEMPLATE_NAME,
      },
    }),
    prisma.smsSendLog.create({
      data: {
        leadId: params.leadId,
        organizationId: params.organizationId,
        sentById: params.sentById,
        message: params.message,
        status: params.ok ? 'SENT' : 'FAILED',
        twilioSid: params.sid,
        error: params.ok ? null : params.error,
      },
    }),
  ])
  return { messageId: msg.id }
}

/**
 * Lead-scoped invite SMS. Persists Message + SmsSendLog and publishes a
 * realtime event. Signature retained (param key `lead`) for backward compat
 * with route handlers + tests.
 */
export async function sendAgreementInviteSms(params: {
  lead: RecipientForInvite
  orgId: string
  staffId: string
  url: string
  title: string
  orgName: string
}): Promise<void> {
  const message = buildInviteMessage(params.lead, params.url, params.title, params.orgName)
  // sendSmsOnly returns success=false with error='SMS_NOT_CONFIGURED' when
  // Twilio isn't set up — handled uniformly with other failures below.
  const result: Awaited<ReturnType<typeof sendSmsOnly>> = isTwilioConfigured()
    ? await sendSmsOnly(params.lead.phone, message)
    : { success: false, error: 'SMS_NOT_CONFIGURED' }
  const twilioStatus = result.success
    ? (result.status || 'queued')
    : `ERROR: ${result.error ?? 'unknown'}`

  const { messageId } = await persistAgreementSms({
    leadId: params.lead.id,
    organizationId: params.orgId,
    sentById: params.staffId,
    message,
    ok: result.success,
    sid: result.sid ?? null,
    error: result.error ?? null,
    twilioStatus,
  })

  if (messageId) {
    publishMessageEventFromLead(params.lead.id, {
      id: messageId,
      direction: 'OUTBOUND',
      channel: 'SMS',
    }).catch(() => {})
  }
}

/**
 * Client-scoped invite SMS. Dispatches via Twilio AND persists the message to
 * the client's latest TaxCase Conversation so the chat panel surfaces both
 * successes and failures (failures via twilioStatus `ERROR: ...`).
 */
export async function sendAgreementInviteSmsForClient(params: {
  client: RecipientForInvite
  orgId: string
  staffId: string
  url: string
  title: string
  orgName: string
}): Promise<void> {
  const message = buildInviteMessage(params.client, params.url, params.title, params.orgName)
  const result: Awaited<ReturnType<typeof sendSmsOnly>> = isTwilioConfigured()
    ? await sendSmsOnly(params.client.phone, message)
    : { success: false, error: 'SMS_NOT_CONFIGURED' }

  // Resolve latest TaxCase for this client; fall back to a console warn if
  // there is no case yet (rare — invite is normally sent after case creation).
  const latestCase = await prisma.taxCase.findFirst({
    where: { clientId: params.client.id },
    orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  })

  if (!latestCase) {
    if (!result.success) {
      console.warn(
        `[Agreement] Client invite SMS failed for client=${params.client.id} org=${params.orgId}: ${result.error ?? 'unknown'} (no TaxCase, message not persisted)`,
      )
    } else {
      console.warn(
        `[Agreement] Client invite SMS sent for client=${params.client.id} but no TaxCase — message not persisted to chat`,
      )
    }
    return
  }

  const conversation = await prisma.conversation.upsert({
    where: { caseId: latestCase.id },
    update: {},
    create: { caseId: latestCase.id },
  })

  const persisted = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'SMS',
      direction: 'OUTBOUND',
      content: message,
      twilioSid: result.success ? (result.sid ?? null) : null,
      twilioStatus: result.success
        ? (result.status || 'queued')
        : `ERROR: ${result.error ?? 'unknown'}`,
      sentById: params.staffId,
      templateUsed: AGREEMENT_INVITE_TEMPLATE_NAME,
    },
  })

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })
  await prisma.taxCase.update({
    where: { id: latestCase.id },
    data: { lastContactAt: new Date() },
  })

  publishMessageEventFromConversation(conversation.id, {
    id: persisted.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
  }).catch(() => {})
}

export async function sendAgreementInviteSmsBestEffort(
  params: Parameters<typeof sendAgreementInviteSms>[0],
): Promise<void> {
  try {
    await sendAgreementInviteSms(params)
  } catch (error) {
    console.error(
      `[Agreement] Lead invite notification failed after agreement commit lead=${params.lead.id} org=${params.orgId}`,
      error,
    )
  }
}

export async function sendAgreementInviteSmsForClientBestEffort(
  params: Parameters<typeof sendAgreementInviteSmsForClient>[0],
): Promise<void> {
  try {
    await sendAgreementInviteSmsForClient(params)
  } catch (error) {
    console.error(
      `[Agreement] Client invite notification failed after agreement commit client=${params.client.id} org=${params.orgId}`,
      error,
    )
  }
}
