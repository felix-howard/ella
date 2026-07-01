/**
 * Twilio Webhook Handler
 * Processes incoming SMS messages from clients
 * Supports both known clients and unknown callers (creates placeholder conversation)
 */
import { prisma } from '../../lib/db'
import { isBizWithGroup } from '../../lib/client-helpers'
import { config } from '../../lib/config'
import type { MessageChannel, MessageDirection, ActionType } from '@ella/db'
import crypto from 'crypto'
import { processMmsMedia } from './mms-media-handler'
import { updateLastActivity } from '../activity-tracker'
import { publishMessageEventFromConversation } from '../realtime/message-publisher'
import { notifyClientMessagePushFromConversation } from '../web-push'
import { processTapbackReaction } from './tapback-reaction-handler'
import {
  isValidE164Phone,
  createPlaceholderConversation,
  sanitizePhone,
} from '../voice/voicemail-helpers'
import { findLeadByPhone, processLeadInbound } from './lead-inbound-handler'

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
  leadId?: string // Set when inbound routed to a Lead (non-CONVERTED match)
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

async function resolveIncomingMessageOrganizationId(toPhone: string): Promise<string | null> {
  if (!isValidE164Phone(toPhone)) {
    return null
  }

  const phoneCandidates = buildIncomingPhoneCandidates(toPhone)
  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      firmPhone: { in: phoneCandidates },
    },
    select: { id: true },
    take: 2,
  })

  if (organizations.length === 1) return organizations[0].id
  if (organizations.length > 1) return null

  if (config.twilio.phoneNumber && toPhone === config.twilio.phoneNumber) {
    const activeOrganizations = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 2,
    })
    if (activeOrganizations.length === 1) {
      console.warn('[Webhook] Falling back to only active organization for configured Twilio number')
      return activeOrganizations[0].id
    }
  }

  return null
}

function buildIncomingPhoneCandidates(e164Phone: string): string[] {
  const digits = e164Phone.replace(/\D/g, '')
  const candidates = new Set([e164Phone])

  if (digits.length === 11 && digits.startsWith('1')) {
    const national = digits.slice(1)
    candidates.add(national)
    candidates.add(digits)
    candidates.add(`(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`)
    candidates.add(`${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`)
    candidates.add(`+1 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`)
  }

  return Array.from(candidates)
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

  const recipientOrgId = await resolveIncomingMessageOrganizationId(incomingMsg.To)
  if (!recipientOrgId) {
    console.warn('[Webhook] Unable to resolve organization for inbound SMS recipient')
    return { success: false, error: 'ORG_NOT_RESOLVED' }
  }

  // Normalize phone for lookup - use exact matches with normalized format
  const normalizedPhone = normalizePhoneForLookup(fromPhone)
  const e164Phone = '+1' + normalizedPhone // US format

  // Find client and lead in parallel (phone may belong to either)
  const [client, lead] = await Promise.all([
    prisma.client.findFirst({
      where: {
        organizationId: recipientOrgId,
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
    }),
    findLeadByPhone(fromPhone, recipientOrgId),
  ])

  // Schema has no Client.status ARCHIVED or TaxCase archival state, so "active case"
  // per brainstorm §5.3 resolves to "client has any tax case" in this codebase.
  const hasClientCase = Boolean(client?.taxCases[0])

  // Phone collision: matches both a client case AND a non-converted lead.
  // Rare: converted-lead phone reuse or data entry mistake. Client case wins (brainstorm §5.3).
  // Mask phone to last 4 — spec §Security requires no full-phone PII in logs.
  if (hasClientCase && lead) {
    const phoneLast4 = sanitizePhone(fromPhone).slice(-4)
    console.warn('[InboundCollision]', {
      phone: `****${phoneLast4}`,
      clientId: client!.id,
      leadId: lead.id,
      sid: twilioSid,
    })
  }

  // Priority 2 routing: no client case, but a lead matches → Lead branch.
  // Client case takes priority (handled below in existing flow).
  if (!hasClientCase && lead) {
    return await processLeadInbound(lead, incomingMsg, content)
  }

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
    const placeholderConversation = await createPlaceholderConversation(fromPhone, recipientOrgId, 'INCOMING_SMS')
    conversationId = placeholderConversation.id

    // Get the case ID from the conversation
    const conversationWithCase = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { caseId: true },
    })
    caseId = conversationWithCase!.caseId
  } else {
    // KNOWN CLIENT: Use existing client's latest case
    let targetCase = client.taxCases[0]
    if (!targetCase) {
      console.log(`[Webhook] Client ${client.id} has no tax cases`)
      return { success: false, error: 'NO_TAX_CASE' }
    }

    // If inbound SMS from a business phone in a group, redirect to individual's case
    if (isBizWithGroup(client)) {
      const individual = await prisma.client.findFirst({
        where: {
          organizationId: recipientOrgId,
          clientGroupId: client.clientGroupId!,
          clientType: 'INDIVIDUAL',
        },
        include: { taxCases: { orderBy: { createdAt: 'desc' }, take: 1 } },
      })
      if (individual?.taxCases[0]) {
        console.log(`[Webhook] Redirected business ${client.id} SMS → individual ${individual.id}`)
        targetCase = individual.taxCases[0]
      }
    }

    caseId = targetCase.id

    // Get or create conversation
    const conversation = await prisma.conversation.upsert({
      where: { caseId: targetCase.id },
      update: {},
      create: { caseId: targetCase.id },
    })
    conversationId = conversation.id
  }

  if (!hasMedia) {
    const tapbackResult = await processTapbackReaction({
      conversationId,
      content,
      twilioSid,
    })

    if (tapbackResult) {
      publishMessageEventFromConversation(conversationId, {
        id: tapbackResult.targetMessageId,
        direction: 'INBOUND',
        channel: 'SMS',
      }).catch(() => {})

      return {
        success: true,
        messageId: tapbackResult.targetMessageId,
        caseId,
        actionCreated: false,
        isUnknownCaller,
      }
    }
  }

  // Process MMS media (download from Twilio, upload to R2, create RawImage)
  // Note: For unknown callers, media will be attached to their placeholder case
  const mmsResult = await processMmsMedia(incomingMsg, caseId)

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        channel: 'SMS' as MessageChannel,
        direction: 'INBOUND' as MessageDirection,
        content,
        twilioSid,
        attachmentUrls: mmsResult.attachmentUrls,
        attachmentR2Keys: mmsResult.attachmentR2Keys,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    }),
  ])

  // Publish realtime event (non-blocking)
  publishMessageEventFromConversation(conversationId, {
    id: message.id,
    direction: 'INBOUND',
    channel: 'SMS',
  }).catch(() => {})
  notifyClientMessagePushFromConversation(conversationId, message).catch(() => {})

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
        ? `New number texted: ${escapedContent.substring(0, 35)}${escapedContent.length > 35 ? '...' : ''} + ${mediaCount} images`
        : `New number sent ${mediaCount} images`
      : `New number texted: ${escapedContent.substring(0, 45)}${escapedContent.length > 45 ? '...' : ''}`
    actionDescription = `Message from new number: ${safePhone}${mediaCount > 0 ? ` (${mediaCount} attachments)` : ''}`
  } else {
    // Known client - existing behavior
    actionTitle = mediaCount > 0
      ? content
        ? `Client sent: ${escapedContent.substring(0, 40)}${escapedContent.length > 40 ? '...' : ''} + ${mediaCount} images`
        : `Client sent ${mediaCount} images`
      : `Client replied: ${escapedContent.substring(0, 50)}${escapedContent.length > 50 ? '...' : ''}`
    actionDescription = mediaCount > 0
      ? `MMS from ${safePhone} with ${mediaCount} attachments`
      : `New message from ${safePhone}`
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
