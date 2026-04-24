/**
 * Lead Inbound SMS Handler
 * Routes inbound SMS to a Lead (non-CONVERTED) by phone match.
 * Creates polymorphic Message(leadId, INBOUND, SMS) and publishes realtime event.
 *
 * v1 limitation: attachments (MMS) are dropped — brainstorm §9.
 */
import type { Lead, MessageChannel, MessageDirection } from '@ella/db'
import { prisma } from '../../lib/db'
import { publishMessageEventFromLead } from '../realtime/message-publisher'

export interface LeadInboundResult {
  success: boolean
  messageId?: string
  leadId?: string
  error?: string
}

/**
 * Find a Lead matching an inbound phone number.
 * Tries multiple phone formats (raw, E.164, digits-only) to tolerate storage variance.
 * Excludes CONVERTED leads — those are now clients and should take the client flow.
 * Returns most recently updated match to break ties across orgs.
 */
export async function findLeadByPhone(fromPhone: string): Promise<Lead | null> {
  const digits = fromPhone.replace(/\D/g, '')
  const normalized =
    digits.startsWith('1') && digits.length === 11 ? digits.substring(1) : digits
  const e164 = '+1' + normalized

  return await prisma.lead.findFirst({
    where: {
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

/**
 * Process inbound SMS routed to a Lead.
 * Creates Message(leadId) and publishes realtime event on the lead's org channel.
 * Assumes caller has already performed twilioSid idempotency check.
 */
export async function processLeadInbound(
  lead: Lead,
  content: string,
  twilioSid: string,
  numMedia: number
): Promise<LeadInboundResult> {
  if (numMedia > 0) {
    console.warn(
      `[LeadInbound] MMS to lead ${lead.id} not supported v1, dropping ${numMedia} attachment(s)`
    )
  }

  const message = await prisma.message.create({
    data: {
      leadId: lead.id,
      channel: 'SMS' as MessageChannel,
      direction: 'INBOUND' as MessageDirection,
      content,
      twilioSid,
    },
  })

  // Non-blocking realtime broadcast — mirrors conversation publisher pattern
  publishMessageEventFromLead(lead.id, {
    id: message.id,
    direction: 'INBOUND',
    channel: 'SMS',
  }).catch(() => {})

  console.log(`[LeadInbound] Message ${message.id} recorded for lead ${lead.id}`)

  return { success: true, messageId: message.id, leadId: lead.id }
}
