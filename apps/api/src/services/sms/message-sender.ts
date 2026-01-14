/**
 * Message Sender Service
 * High-level service for sending SMS messages with database tracking
 */
import { prisma } from '../../lib/db'
import { sendSms, formatPhoneToE164, isTwilioConfigured } from './twilio-client'
import {
  generateWelcomeMessage,
  generateMissingDocsMessage,
  generateBlurryResendMessage,
  generateCompleteMessage,
  type TemplateName,
  type SmsLanguage,
} from './templates'
import type { MessageChannel, MessageDirection } from '@ella/db'

export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
  smsSent: boolean
}

/**
 * Send welcome message with magic link to new client
 */
export async function sendWelcomeMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  taxYear: number,
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  const body = generateWelcomeMessage({
    clientName,
    magicLink,
    taxYear,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'welcome')
}

/**
 * Send missing documents reminder
 */
export async function sendMissingDocsReminder(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  missingDocs: string[],
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  if (missingDocs.length === 0) {
    return { success: false, error: 'NO_MISSING_DOCS', smsSent: false }
  }

  const body = generateMissingDocsMessage({
    clientName,
    magicLink,
    missingDocs,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'missing_docs')
}

/**
 * Send blurry image resend request
 */
export async function sendBlurryResendRequest(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  docTypes: string[],
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  if (docTypes.length === 0) {
    return { success: false, error: 'NO_BLURRY_DOCS', smsSent: false }
  }

  const body = generateBlurryResendMessage({
    clientName,
    magicLink,
    docTypes,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'blurry_resend')
}

/**
 * Send documents complete notification
 */
export async function sendDocsCompleteMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  taxYear: number,
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  const body = generateCompleteMessage({
    clientName,
    taxYear,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'complete')
}

/**
 * Send custom message (for staff-initiated messages)
 */
export async function sendCustomMessage(
  caseId: string,
  clientPhone: string,
  content: string
): Promise<SendMessageResult> {
  return sendAndRecordMessage(caseId, clientPhone, content, undefined)
}

/**
 * Internal: Send SMS and record in database
 */
async function sendAndRecordMessage(
  caseId: string,
  phone: string,
  content: string,
  templateName: TemplateName | undefined
): Promise<SendMessageResult> {
  // Get or create conversation
  const conversation = await prisma.conversation.upsert({
    where: { caseId },
    update: {},
    create: { caseId },
  })

  // Create message record
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'SMS' as MessageChannel,
      direction: 'OUTBOUND' as MessageDirection,
      content,
      templateUsed: templateName,
    },
  })

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  // Update case last contact
  await prisma.taxCase.update({
    where: { id: caseId },
    data: { lastContactAt: new Date() },
  })

  // Send SMS if Twilio is configured
  let smsSent = false
  let smsError: string | undefined

  if (isTwilioConfigured()) {
    const formattedPhone = formatPhoneToE164(phone)
    const result = await sendSms({
      to: formattedPhone,
      body: content,
    })

    smsSent = result.success
    if (!result.success) {
      smsError = result.error

      // Store error in twilioStatus field (proper field for status info)
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: null,
          twilioStatus: `ERROR: ${smsError}`,
        },
      })
    } else if (result.sid) {
      // Store successful Twilio SID
      await prisma.message.update({
        where: { id: message.id },
        data: {
          twilioSid: result.sid,
          twilioStatus: result.status,
        },
      })
    }
  }

  return {
    success: true,
    messageId: message.id,
    smsSent,
    error: smsError,
  }
}

/**
 * Check if SMS sending is available
 */
export function isSmsEnabled(): boolean {
  return isTwilioConfigured()
}
