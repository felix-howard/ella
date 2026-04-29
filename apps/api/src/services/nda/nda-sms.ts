/**
 * SMS concerns for NDA invites — kept separate from the main service so the
 * template can evolve (EN/VI, copy tweaks) without touching CRUD logic.
 *
 * v1: language hardcoded to EN. A VI translation is available in the template
 * module for future per-lead/per-org language resolution.
 */
import { prisma } from '../../lib/db'
import { sendSmsOnly, isTwilioConfigured } from '../sms'
import { generateNdaMessage } from '../sms/templates'
import { publishMessageEventFromLead } from '../realtime/message-publisher'

interface LeadForInvite {
  id: string
  firstName: string
  phone: string
}

export function buildInviteMessage(lead: { firstName: string }, url: string): string {
  return generateNdaMessage({
    firstName: lead.firstName,
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

export async function sendNdaInviteSms(params: {
  lead: LeadForInvite
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
