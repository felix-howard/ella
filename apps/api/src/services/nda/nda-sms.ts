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

async function logSms(params: {
  leadId: string
  organizationId: string
  sentById: string
  message: string
  ok: boolean
  sid: string | null
  error: string | null
}): Promise<void> {
  await prisma.smsSendLog.create({
    data: {
      leadId: params.leadId,
      organizationId: params.organizationId,
      sentById: params.sentById,
      message: params.message,
      status: params.ok ? 'SENT' : 'FAILED',
      twilioSid: params.sid,
      error: params.error,
    },
  })
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
  await logSms({
    leadId: params.lead.id,
    organizationId: params.orgId,
    sentById: params.staffId,
    message,
    ok: result.success,
    sid: result.sid ?? null,
    error: result.error ?? null,
  })
}
