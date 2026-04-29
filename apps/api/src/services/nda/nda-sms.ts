/**
 * SMS concerns for NDA invites — kept separate from the main service so the
 * template can evolve (EN/VI, copy tweaks) without touching CRUD logic.
 *
 * Lead path (sendNdaInviteSms): persists Message via Message.leadId and
 * records SmsSendLog audit, then broadcasts a realtime event.
 *
 * Client path (sendNdaInviteSmsForClient): persists Message via the client's
 * latest TaxCase Conversation (Message.conversationId), so chat panels show
 * the invite — successes AND failures (failures land with twilioStatus
 * `ERROR: ...`, mirroring services/sms/message-sender.ts). SmsSendLog is
 * still skipped on this branch because that model's `leadId` is NOT NULL;
 * Twilio's own log remains the audit source for client SMS until schema
 * parity. If the client has no TaxCase, persistence is skipped with a warn
 * (rare — NDA is normally sent after a case exists).
 *
 * v1: language hardcoded to EN. A VI translation is available in the template
 * module for future per-recipient/per-org language resolution.
 */
import { prisma } from '../../lib/db'
import { sendSmsOnly, isTwilioConfigured } from '../sms'
import { generateNdaMessage } from '../sms/templates'
import {
  publishMessageEventFromLead,
  publishMessageEventFromConversation,
} from '../realtime/message-publisher'

export interface RecipientForInvite {
  id: string
  firstName: string
  phone: string
}

export function buildInviteMessage(recipient: { firstName: string }, url: string): string {
  return generateNdaMessage({
    firstName: recipient.firstName,
    ndaUrl: url,
    language: 'EN',
  })
}

async function persistNdaSms(params: {
  leadId: string
  organizationId: string
  sentById: string
  message: string
  ok: boolean
  sid: string | null
  error: string | null
  twilioStatus: string
}): Promise<{ messageId: string | null }> {
  // Persist to Message (chat history) + SmsSendLog (audit) atomically.
  // Only create Message when SMS actually succeeded so failed sends don't
  // pollute the chat panel — failures still land in SmsSendLog for ops.
  if (params.ok) {
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
          templateUsed: 'NDA_INVITE',
        },
      }),
      prisma.smsSendLog.create({
        data: {
          leadId: params.leadId,
          organizationId: params.organizationId,
          sentById: params.sentById,
          message: params.message,
          status: 'SENT',
          twilioSid: params.sid,
          error: null,
        },
      }),
    ])
    return { messageId: msg.id }
  }

  await prisma.smsSendLog.create({
    data: {
      leadId: params.leadId,
      organizationId: params.organizationId,
      sentById: params.sentById,
      message: params.message,
      status: 'FAILED',
      twilioSid: params.sid,
      error: params.error,
    },
  })
  return { messageId: null }
}

/**
 * Lead-scoped invite SMS. Persists Message + SmsSendLog and publishes a
 * realtime event. Signature retained (param key `lead`) for backward compat
 * with route handlers + tests.
 */
export async function sendNdaInviteSms(params: {
  lead: RecipientForInvite
  orgId: string
  staffId: string
  url: string
}): Promise<void> {
  if (!isTwilioConfigured()) {
    console.warn('[NDA] Twilio not configured; skipping invite SMS')
    return
  }
  const message = buildInviteMessage(params.lead, params.url)
  const result = await sendSmsOnly(params.lead.phone, message)
  const twilioStatus = result.success
    ? (result.status || 'queued')
    : `ERROR: ${result.error ?? 'unknown'}`

  const { messageId } = await persistNdaSms({
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
export async function sendNdaInviteSmsForClient(params: {
  client: RecipientForInvite
  orgId: string
  staffId: string
  url: string
}): Promise<void> {
  if (!isTwilioConfigured()) {
    console.warn('[NDA] Twilio not configured; skipping invite SMS')
    return
  }
  const message = buildInviteMessage(params.client, params.url)
  const result = await sendSmsOnly(params.client.phone, message)

  // Resolve latest TaxCase for this client; fall back to a console warn if
  // there is no case yet (rare — NDA is normally sent after case creation).
  const latestCase = await prisma.taxCase.findFirst({
    where: { clientId: params.client.id },
    orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  })

  if (!latestCase) {
    if (!result.success) {
      console.warn(
        `[NDA] Client invite SMS failed for client=${params.client.id} org=${params.orgId}: ${result.error ?? 'unknown'} (no TaxCase, message not persisted)`,
      )
    } else {
      console.warn(
        `[NDA] Client invite SMS sent for client=${params.client.id} but no TaxCase — message not persisted to chat`,
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
      templateUsed: 'NDA_INVITE',
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
