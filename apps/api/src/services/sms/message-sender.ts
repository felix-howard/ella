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
  generateScheduleCMessage,
  generateScheduleEMessage,
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
 * Replace placeholders in template content with actual values
 * Placeholders format: {placeholderName}
 */
function replacePlaceholders(
  content: string,
  values: Record<string, string | number>
): string {
  let result = content
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * Send welcome message with magic link to new client
 * Uses database template if available (WELCOME category), otherwise fallback to hardcoded
 */
export async function sendWelcomeMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  taxYear: number,
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  let body: string

  // Try to get welcome template from database
  const dbTemplate = await prisma.messageTemplate.findFirst({
    where: {
      category: 'WELCOME',
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  if (dbTemplate) {
    // Use database template with placeholder replacement
    body = replacePlaceholders(dbTemplate.content, {
      clientName,
      portalUrl: magicLink,
      taxYear,
    })
  } else {
    // Fallback to hardcoded template
    body = generateWelcomeMessage({
      clientName,
      magicLink,
      taxYear,
      language,
    })
  }

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
 * NOTE: This creates a message record - use sendSmsOnly if record already exists
 */
export async function sendCustomMessage(
  caseId: string,
  clientPhone: string,
  content: string
): Promise<SendMessageResult> {
  return sendAndRecordMessage(caseId, clientPhone, content, undefined)
}

/**
 * Send SMS only without creating a message record
 * Use this when the message record is already created (e.g., by API route)
 * Returns the Twilio SID and status for updating the existing record
 */
export async function sendSmsOnly(
  phone: string,
  content: string
): Promise<{ success: boolean; sid?: string; status?: string; error?: string }> {
  if (!isTwilioConfigured()) {
    return { success: false, error: 'SMS_NOT_CONFIGURED' }
  }

  const formattedPhone = formatPhoneToE164(phone)
  const result = await sendSms({
    to: formattedPhone,
    body: content,
  })

  return {
    success: result.success,
    sid: result.sid,
    status: result.status,
    error: result.error,
  }
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
 * Send Schedule C expense form link to client
 * Uses database template if available (SCHEDULE_C category), otherwise fallback to hardcoded
 */
export async function sendScheduleCFormMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  let body: string

  // Try to get Schedule C template from database
  const dbTemplate = await prisma.messageTemplate.findFirst({
    where: {
      category: 'SCHEDULE_C',
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  if (dbTemplate) {
    // Use database template with placeholder replacement
    body = replacePlaceholders(dbTemplate.content, {
      clientName,
      expenseUrl: magicLink,
    })
  } else {
    // Fallback to hardcoded template
    body = generateScheduleCMessage({ clientName, magicLink, language })
  }

  return sendAndRecordMessage(caseId, clientPhone, body, 'schedule_c')
}

/**
 * Check if SMS sending is available
 */
export function isSmsEnabled(): boolean {
  return isTwilioConfigured()
}

/**
 * Send Schedule E rental property form link to client
 * Uses database template if available (SCHEDULE_E category), otherwise fallback to hardcoded
 */
export async function sendScheduleEFormMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  language: SmsLanguage = 'VI'
): Promise<SendMessageResult> {
  let body: string

  // Try to get Schedule E template from database
  const dbTemplate = await prisma.messageTemplate.findFirst({
    where: {
      category: 'SCHEDULE_E',
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  if (dbTemplate) {
    // Use database template with placeholder replacement
    body = replacePlaceholders(dbTemplate.content, {
      clientName,
      rentalUrl: magicLink,
    })
  } else {
    // Fallback to hardcoded template
    body = generateScheduleEMessage({ clientName, magicLink, language })
  }

  return sendAndRecordMessage(caseId, clientPhone, body, 'schedule_e')
}
