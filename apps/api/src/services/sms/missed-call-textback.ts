/**
 * Missed Call Text-Back Service
 * Automatically sends SMS to callers when their call is missed
 * Checks org setting (missedCallTextBack) before sending
 */
import { prisma } from '../../lib/db'
import { sendSms, formatPhoneToE164, isTwilioConfigured } from './twilio-client'
import { generateMissedCallTextbackMessage } from './templates/missed-call-textback'
import { findConversationByPhone, createPlaceholderConversation, isValidE164Phone } from '../voice'
import type { SmsLanguage } from './templates'

/**
 * Send missed call text-back SMS to caller
 * Checks org missedCallTextBack setting, sends SMS, records in conversation
 * @param callerPhone - E.164 formatted caller phone
 * @param organizationId - Org ID (null for unknown callers)
 */
export async function sendMissedCallTextBack(
  callerPhone: string,
  organizationId: string | null
): Promise<void> {
  try {
    if (!isTwilioConfigured()) {
      console.log('[Missed Call TextBack] Twilio not configured, skipping')
      return
    }

    if (!callerPhone || !isValidE164Phone(callerPhone)) {
      console.log(`[Missed Call TextBack] Invalid phone: ${callerPhone}, skipping`)
      return
    }

    // Check if org has missed call text-back enabled
    const orgSettings = organizationId
      ? await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { missedCallTextBack: true, smsLanguage: true },
        })
      : null

    // If org found but feature disabled, skip
    if (orgSettings && !orgSettings.missedCallTextBack) {
      console.log(`[Missed Call TextBack] Disabled for org ${organizationId}, skipping`)
      return
    }

    // If no org found (unknown caller), skip — we need an org setting to authorize sending
    if (!orgSettings) {
      console.log(`[Missed Call TextBack] No org found for caller ${callerPhone}, skipping`)
      return
    }

    const language = (orgSettings.smsLanguage as SmsLanguage) || 'VI'
    const body = generateMissedCallTextbackMessage({ language })

    // Find or create conversation for recording the outbound SMS
    let conversation = await findConversationByPhone(callerPhone)

    if (!conversation) {
      conversation = await createPlaceholderConversation(callerPhone)
    }

    // Send SMS
    const formattedPhone = formatPhoneToE164(callerPhone)
    const smsResult = await sendSms({ to: formattedPhone, body })

    // Record outbound SMS in conversation
    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          conversationId: conversation!.id,
          channel: 'SMS',
          direction: 'OUTBOUND',
          content: body,
          isSystem: true,
          templateUsed: 'missed_call_textback',
          twilioSid: smsResult.sid || null,
          twilioStatus: smsResult.success ? smsResult.status : `ERROR: ${smsResult.error}`,
        },
      })

      await tx.conversation.update({
        where: { id: conversation!.id },
        data: { lastMessageAt: new Date() },
      })
    })

    console.log(
      `[Missed Call TextBack] ${smsResult.success ? 'Sent' : 'Failed'} to ${callerPhone}` +
      `${smsResult.error ? `: ${smsResult.error}` : ''}`
    )
  } catch (error) {
    // Non-blocking: log error but don't throw — missed call text-back should never break call flow
    console.error('[Missed Call TextBack] Error:', error)
  }
}
