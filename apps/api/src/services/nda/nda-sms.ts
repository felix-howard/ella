/**
 * SMS concerns for NDA invites — kept separate from the main service so the
 * template can evolve (EN/VI, copy tweaks) without touching CRUD logic.
 *
 * Lead path (sendNdaInviteSms): persists Message + SmsSendLog and broadcasts
 * a realtime event, identical to pre-refactor behavior.
 *
 * Client path (sendNdaInviteSmsForClient): dispatches the SMS via Twilio but
 * SKIPS Message + SmsSendLog persistence — both models require a non-null
 * `leadId` (Message has no clientId column at all; SmsSendLog.leadId is NOT
 * NULL). Adding those columns is intentionally deferred per phase plan
 * (no DB migration in Phase 01). The asymmetry is documented; client NDA SMS
 * audit can be reconstructed from Twilio logs until the schema gains parity.
 *
 * v1: language hardcoded to EN. A VI translation is available in the template
 * module for future per-recipient/per-org language resolution.
 */
import { prisma } from '../../lib/db'
import { sendSmsOnly, isTwilioConfigured } from '../sms'
import { generateNdaMessage } from '../sms/templates'
import { publishMessageEventFromLead } from '../realtime/message-publisher'

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
 * Client-scoped invite SMS. Dispatches via Twilio only — see file header for
 * why persistence is deliberately skipped on this branch.
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
  if (!result.success) {
    console.warn(
      `[NDA] Client invite SMS failed for client=${params.client.id} org=${params.orgId}: ${result.error ?? 'unknown'}`,
    )
  }
  // No Message / SmsSendLog persist on the client branch (schema lacks clientId
  // on those models). Twilio's own log is the audit source until schema parity.
}
