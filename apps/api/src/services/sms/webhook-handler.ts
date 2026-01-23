/**
 * Twilio Webhook Handler
 * Processes incoming SMS messages from clients
 * Supports both known clients and unknown callers (creates placeholder conversation)
 */
import { prisma } from '../../lib/db'
import { config } from '../../lib/config'
import type { MessageChannel, MessageDirection, ActionType } from '@ella/db'
import crypto from 'crypto'
import { processMmsMedia } from './mms-media-handler'
import { updateLastActivity } from '../activity-tracker'
import {
  isValidE164Phone,
  createPlaceholderConversation,
  sanitizePhone,
} from '../voice/voicemail-helpers'

export interface TwilioIncomingMessage {
  MessageSid: string
  AccountSid: string
  From: string
  To: string
  Body: string
  NumMedia?: string
  // Twilio sends up to 10 media items (MediaUrl0-9, MediaContentType0-9)
  MediaUrl0?: string
  MediaContentType0?: string
  MediaUrl1?: string
  MediaContentType1?: string
  MediaUrl2?: string
  MediaContentType2?: string
  MediaUrl3?: string
  MediaContentType3?: string
  MediaUrl4?: string
  MediaContentType4?: string
  MediaUrl5?: string
  MediaContentType5?: string
  MediaUrl6?: string
  MediaContentType6?: string
  MediaUrl7?: string
  MediaContentType7?: string
  MediaUrl8?: string
  MediaContentType8?: string
  MediaUrl9?: string
  MediaContentType9?: string
}

export interface ProcessIncomingResult {
  success: boolean
  messageId?: string
  caseId?: string
  actionCreated?: boolean
  error?: string
  isUnknownCaller?: boolean // True if message is from a number not in our client list
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
  const content = sanitizeMessageContent(rawContent || '')
  const hasMedia = parseInt(incomingMsg.NumMedia || '0', 10) > 0

  // Allow message if it has content OR media (MMS can have images without text)
  if (!content && !hasMedia) {
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

  // Track whether this is an unknown caller (new number not in our system)
  let isUnknownCaller = false
  let caseId: string
  let conversationId: string

  if (!client) {
    // UNKNOWN CALLER: Create placeholder conversation for new number
    console.log(`[Webhook] Unknown caller: ${fromPhone}, creating placeholder conversation`)

    // Validate phone format for E.164 storage
    if (!isValidE164Phone(fromPhone)) {
      console.warn(`[Webhook] Invalid phone format from unknown caller: ${fromPhone}`)
      return { success: false, error: 'INVALID_PHONE_FORMAT' }
    }

    isUnknownCaller = true

    // Create placeholder client + tax case + conversation (atomic transaction)
    const placeholderConversation = await createPlaceholderConversation(fromPhone)
    conversationId = placeholderConversation.id

    // Get the case ID from the conversation
    const conversationWithCase = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { caseId: true },
    })
    caseId = conversationWithCase!.caseId
  } else {
    // KNOWN CLIENT: Use existing client's latest case
    const latestCase = client.taxCases[0]
    if (!latestCase) {
      console.log(`[Webhook] Client ${client.id} has no tax cases`)
      return { success: false, error: 'NO_TAX_CASE' }
    }

    caseId = latestCase.id

    // Get or create conversation
    const conversation = await prisma.conversation.upsert({
      where: { caseId: latestCase.id },
      update: {},
      create: { caseId: latestCase.id },
    })
    conversationId = conversation.id
  }

  // Process MMS media (download from Twilio, upload to R2, create RawImage)
  // Note: For unknown callers, media will be attached to their placeholder case
  const mmsResult = await processMmsMedia(incomingMsg, caseId)

  // Create message record (with attachments if media present)
  const message = await prisma.message.create({
    data: {
      conversationId,
      channel: 'SMS' as MessageChannel,
      direction: 'INBOUND' as MessageDirection,
      content,
      twilioSid,
      attachmentUrls: mmsResult.attachmentUrls,
      attachmentR2Keys: mmsResult.attachmentR2Keys,
    },
  })

  // Update conversation with new message timestamp and unread count
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  })

  // Update case activity timestamp for computed status system
  await updateLastActivity(caseId)

  // Create action for staff to review
  // Escape user content to prevent XSS when displaying in admin dashboard
  const mediaCount = mmsResult.attachmentUrls.length
  const escapedContent = escapeXml(content)
  const safePhone = sanitizePhone(fromPhone)

  // Different action title/type for unknown callers vs known clients
  let actionTitle: string
  let actionDescription: string
  const actionType: ActionType = isUnknownCaller ? 'CLIENT_REPLIED' : 'CLIENT_REPLIED'

  if (isUnknownCaller) {
    // Unknown caller - highlight it's a NEW number
    actionTitle = mediaCount > 0
      ? content
        ? `Số mới nhắn: ${escapedContent.substring(0, 35)}${escapedContent.length > 35 ? '...' : ''} + ${mediaCount} ảnh`
        : `Số mới gửi ${mediaCount} ảnh`
      : `Số mới nhắn: ${escapedContent.substring(0, 45)}${escapedContent.length > 45 ? '...' : ''}`
    actionDescription = `Tin nhắn từ số mới: ${safePhone}${mediaCount > 0 ? ` (${mediaCount} file đính kèm)` : ''}`
  } else {
    // Known client - existing behavior
    actionTitle = mediaCount > 0
      ? content
        ? `Khách hàng gửi: ${escapedContent.substring(0, 40)}${escapedContent.length > 40 ? '...' : ''} + ${mediaCount} ảnh`
        : `Khách hàng gửi ${mediaCount} ảnh`
      : `Khách hàng trả lời: ${escapedContent.substring(0, 50)}${escapedContent.length > 50 ? '...' : ''}`
    actionDescription = mediaCount > 0
      ? `MMS từ ${safePhone} với ${mediaCount} file đính kèm`
      : `Tin nhắn mới từ ${safePhone}`
  }

  const action = await prisma.action.create({
    data: {
      type: actionType,
      priority: isUnknownCaller ? 'HIGH' : 'NORMAL', // Higher priority for unknown callers
      caseId,
      title: actionTitle,
      description: actionDescription,
      metadata: {
        messageId: message.id,
        preview: escapedContent.substring(0, 100), // Store escaped preview
        fromPhone,
        mediaCount,
        rawImageIds: mmsResult.rawImageIds,
        isUnknownCaller,
      },
    },
  })

  return {
    success: true,
    messageId: message.id,
    caseId,
    actionCreated: Boolean(action),
    isUnknownCaller,
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
