/**
 * Shared SMS send + chat-history persistence for an agreement signer
 * (Lead or Client). Used by the deposit pay-link SMS (phase 2) and the
 * payment receipt SMS (phase 3) so both follow the same delivery path.
 *
 * Persistence mirrors agreement-sms.ts: lead-scoped messages land on
 * Message.leadId + SmsSendLog; client-scoped messages land on the latest
 * TaxCase Conversation. Failures persist too (twilioStatus `ERROR: ...`).
 */
// Direct module imports (not the ../sms barrel) keep the Stripe webhook's
// import graph free of the MMS/AI handler chain.
import { prisma } from '../../lib/db'
import { sendSmsOnly } from '../sms/message-sender'
import { isTwilioConfigured } from '../sms/twilio-client'
import {
  publishMessageEventFromLead,
  publishMessageEventFromConversation,
} from '../realtime/message-publisher'

export interface SignerSmsTarget {
  signerId: string
  signerKind: 'lead' | 'client'
  organizationId: string
  /** Staff user attributed as sender on Message/SmsSendLog rows. */
  sentById: string
}

interface SmsPersistInput {
  message: string
  templateUsed: string
  result: { success: boolean; sid?: string; error?: string }
  twilioStatus: string
}

/**
 * Look up the signer's phone, send the SMS, and persist it to their chat
 * history. Logs + returns silently when no phone is on file.
 */
export async function sendSignerSmsAndPersist(
  target: SignerSmsTarget,
  message: string,
  templateUsed: string,
): Promise<void> {
  const phone =
    target.signerKind === 'lead'
      ? (
          await prisma.lead.findUnique({ where: { id: target.signerId }, select: { phone: true } })
        )?.phone
      : (
          await prisma.client.findUnique({ where: { id: target.signerId }, select: { phone: true } })
        )?.phone
  if (!phone) {
    console.warn(
      `[Payment] No phone for ${target.signerKind}=${target.signerId} — ${templateUsed} SMS skipped`,
    )
    return
  }

  const result = isTwilioConfigured()
    ? await sendSmsOnly(phone, message)
    : { success: false as const, error: 'SMS_NOT_CONFIGURED', sid: undefined, status: undefined }
  const twilioStatus = result.success
    ? (result.status || 'queued')
    : `ERROR: ${result.error ?? 'unknown'}`

  const persistInput: SmsPersistInput = { message, templateUsed, result, twilioStatus }
  if (target.signerKind === 'lead') {
    await persistLeadSms(target, persistInput)
  } else {
    await persistClientSms(target, persistInput)
  }
}

/** Lead path: Message.leadId + SmsSendLog audit, then realtime event. */
async function persistLeadSms(target: SignerSmsTarget, input: SmsPersistInput): Promise<void> {
  const [msg] = await prisma.$transaction([
    prisma.message.create({
      data: {
        leadId: target.signerId,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: input.message,
        twilioSid: input.result.sid ?? null,
        twilioStatus: input.twilioStatus,
        sentById: target.sentById,
        templateUsed: input.templateUsed,
      },
    }),
    prisma.smsSendLog.create({
      data: {
        leadId: target.signerId,
        organizationId: target.organizationId,
        sentById: target.sentById,
        message: input.message,
        status: input.result.success ? 'SENT' : 'FAILED',
        twilioSid: input.result.sid ?? null,
        error: input.result.success ? null : (input.result.error ?? null),
      },
    }),
  ])
  publishMessageEventFromLead(target.signerId, {
    id: msg.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
  }).catch(() => {})
}

/** Client path: persist into latest TaxCase Conversation (skip w/ warn if none). */
async function persistClientSms(target: SignerSmsTarget, input: SmsPersistInput): Promise<void> {
  const latestCase = await prisma.taxCase.findFirst({
    where: { clientId: target.signerId },
    orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  })
  if (!latestCase) {
    console.warn(
      `[Payment] ${input.templateUsed} SMS ${input.result.success ? 'sent' : 'failed'} for client=${target.signerId} but no TaxCase — message not persisted to chat`,
    )
    return
  }

  const conversation = await prisma.conversation.upsert({
    where: { caseId: latestCase.id },
    update: {},
    create: { caseId: latestCase.id },
  })
  // Atomic persist: message + timestamp bumps land together (or not at all).
  const [persisted] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: input.message,
        twilioSid: input.result.success ? (input.result.sid ?? null) : null,
        twilioStatus: input.twilioStatus,
        sentById: target.sentById,
        templateUsed: input.templateUsed,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
    prisma.taxCase.update({
      where: { id: latestCase.id },
      data: { lastContactAt: new Date() },
    }),
  ])
  publishMessageEventFromConversation(conversation.id, {
    id: persisted.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
  }).catch(() => {})
}
