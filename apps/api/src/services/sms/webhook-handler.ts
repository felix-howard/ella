/**
 * Twilio Webhook Handler
 * Processes incoming SMS messages from clients
 */
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import type { MessageChannel, MessageDirection, ActionType } from '@ella/db'
import crypto from 'crypto'

export interface TwilioIncomingMessage {
  MessageSid: string
  AccountSid: string
  From: string
  To: string
  Body: string
  NumMedia?: string
  MediaUrl0?: string
  MediaContentType0?: string
}

export interface ProcessIncomingResult {
  success: boolean
  messageId?: string
  caseId?: string
  actionCreated?: boolean
  error?: string
}

export interface SignatureValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate Twilio webhook signature (timing-safe comparison)
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): SignatureValidationResult {
  // CRITICAL: Reject requests when not configured in production
  if (!config.twilio.authToken) {
    if (config.nodeEnv === 'production') {
      console.error('[Twilio] Auth token not configured in production - rejecting request')
      return { valid: false, error: 'TWILIO_NOT_CONFIGURED' }
    }
    // Only allow bypass in development with explicit warning
    console.warn('[Twilio] DEV MODE: Signature validation bypassed')
    return { valid: true }
  }

  if (!signature) {
    return { valid: false, error: 'MISSING_SIGNATURE' }
  }

  // Build the validation string (URL + sorted params)
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join('')

  const data = url + sortedParams

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha1', config.twilio.authToken)
    .update(data, 'utf8')
    .digest('base64')

  // SECURITY: Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, 'base64')
    const expectedBuffer = Buffer.from(expectedSignature, 'base64')

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'INVALID_SIGNATURE' }
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    return { valid: isValid, error: isValid ? undefined : 'INVALID_SIGNATURE' }
  } catch {
    return { valid: false, error: 'SIGNATURE_COMPARISON_FAILED' }
  }
}

/**
 * Sanitize message content (prevent XSS, limit length)
 */
function sanitizeMessageContent(content: string): string {
  // Limit length to prevent DoS
  const maxLength = 1600 // SMS limit
  let sanitized = content.slice(0, maxLength)

  // Remove control characters except newlines (\n=0x0A) and tabs (\t=0x09)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')

  return sanitized.trim()
}

/**
 * Process incoming SMS message
 * Finds associated case by phone number and records message
 */
export async function processIncomingMessage(
  incomingMsg: TwilioIncomingMessage
): Promise<ProcessIncomingResult> {
  const { From: fromPhone, Body: rawContent, MessageSid: twilioSid } = incomingMsg

  // Sanitize content
  const content = sanitizeMessageContent(rawContent)
  if (!content) {
    return { success: false, error: 'EMPTY_MESSAGE' }
  }

  // Check for duplicate (replay attack prevention)
  if (twilioSid) {
    const existingMessage = await prisma.message.findFirst({
      where: { twilioSid },
    })
    if (existingMessage) {
      console.log(`[Webhook] Duplicate message: ${twilioSid}`)
      return { success: false, error: 'DUPLICATE_MESSAGE' }
    }
  }

  // Normalize phone for lookup - use exact matches with normalized format
  const normalizedPhone = normalizePhoneForLookup(fromPhone)
  const e164Phone = '+1' + normalizedPhone // US format

  // Find client by phone - use indexed exact matches
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { phone: fromPhone },        // Exact match original
        { phone: e164Phone },        // E.164 format
        { phone: normalizedPhone },  // Digits only
      ],
    },
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!client) {
    console.log(`[Webhook] No client found for phone: ${fromPhone}`)
    return { success: false, error: 'CLIENT_NOT_FOUND' }
  }

  const latestCase = client.taxCases[0]
  if (!latestCase) {
    console.log(`[Webhook] Client ${client.id} has no tax cases`)
    return { success: false, error: 'NO_TAX_CASE' }
  }

  // Get or create conversation
  const conversation = await prisma.conversation.upsert({
    where: { caseId: latestCase.id },
    update: {},
    create: { caseId: latestCase.id },
  })

  // Create message record
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'SMS' as MessageChannel,
      direction: 'INBOUND' as MessageDirection,
      content,
      twilioSid,
    },
  })

  // Update conversation with new message timestamp and unread count
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  })

  // Create action for staff to review
  const action = await prisma.action.create({
    data: {
      type: 'CLIENT_REPLIED' as ActionType,
      priority: 'NORMAL',
      caseId: latestCase.id,
      title: `Khách hàng trả lời: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      description: `Tin nhắn mới từ ${escapeXml(fromPhone)}`,
      metadata: {
        messageId: message.id,
        preview: content.substring(0, 100),
        fromPhone,
      },
    },
  })

  return {
    success: true,
    messageId: message.id,
    caseId: latestCase.id,
    actionCreated: Boolean(action),
  }
}

/**
 * Normalize phone number for database lookup (10 digits US)
 */
function normalizePhoneForLookup(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '')

  // Remove leading country code (1 for US)
  if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.substring(1)
  }

  return digits
}

/**
 * Generate TwiML response for Twilio
 */
export function generateTwimlResponse(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`
  }

  // Empty response (no auto-reply)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
