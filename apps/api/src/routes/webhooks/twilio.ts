/**
 * Twilio Webhook Route
 * Handles incoming SMS messages and voice call webhooks from Twilio
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { getTwilioSmsErrorMessage } from '@ella/shared'
import {
  processIncomingMessage,
  validateTwilioSignature,
  generateTwimlResponse,
  sendMissedCallTextBack,
  type TwilioIncomingMessage,
} from '../../services/sms'
import {
  generateTwimlVoiceResponse,
  generateEmptyTwimlResponse,
  generateIncomingTwiml,
  generateNoStaffTwiml,
  generateVoicemailTwiml,
  generateVoicemailCompleteTwiml,
  findConversationByPhone,
  createPlaceholderConversation,
  recordMissedInboundCall,
  formatVoicemailDuration,
  isValidE164Phone,
  sanitizeRecordingDuration,
} from '../../services/voice'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { publishMessageEventFromConversation } from '../../services/realtime/message-publisher'

const twilioWebhookRoute = new Hono()

// Simple in-memory rate limiter for webhook endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60 // 60 requests per minute per IP

async function resolveIncomingCallOrganizationId(toPhone: string): Promise<string | null> {
  if (!isValidE164Phone(toPhone)) return null

  const phoneCandidates = buildIncomingPhoneCandidates(toPhone)
  const orgsByFirmPhone = await prisma.organization.findMany({
    where: { isActive: true, firmPhone: { in: phoneCandidates } },
    select: { id: true },
    take: 2,
  })
  if (orgsByFirmPhone.length === 1) return orgsByFirmPhone[0].id
  if (orgsByFirmPhone.length > 1) return null

  if (config.twilio.phoneNumber && toPhone === config.twilio.phoneNumber) {
    const activeOrgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 2,
    })
    if (activeOrgs.length === 1) {
      console.warn('[Voice Webhook] Falling back to only active organization for configured Twilio number')
      return activeOrgs[0].id
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

function getWebhookRequestUrl(c: Context, forwardedProto: string, forwardedHost: string): string {
  const requestUrl = new URL(c.req.url)
  return `${forwardedProto}://${forwardedHost}${requestUrl.pathname}${requestUrl.search}`
}

function buildVoiceWebhookUrl(path: string, calledNumber?: string): string {
  const url = new URL(path, config.twilio.webhookBaseUrl)
  if (calledNumber) {
    url.searchParams.set('calledNumber', calledNumber)
  }
  return url.toString()
}

function getCalledNumber(c: Context, formData: Record<string, unknown>): string {
  const queryCalledNumber = new URL(c.req.url).searchParams.get('calledNumber')
  return queryCalledNumber || (formData.To || formData.Called || '') as string
}

async function resolveOutboundCallDestination(input: {
  to?: string
  messageId?: string
  caseId?: string
  callSid?: string
}): Promise<string | null> {
  const messageId = input.messageId?.trim()
  const caseId = input.caseId?.trim()

  if (messageId) {
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        channel: 'CALL',
        direction: 'OUTBOUND',
        ...(caseId ? { conversation: { caseId } } : {}),
      },
      include: {
        conversation: {
          include: {
            taxCase: {
              include: { client: true },
            },
          },
        },
      },
    })

    if (message) {
      if (input.callSid) {
        await prisma.message.update({
          where: { id: message.id },
          data: { callSid: input.callSid },
        })
      }

      const clientPhone = message.conversation?.taxCase.client.phone
      if (clientPhone && isValidE164Phone(clientPhone)) {
        return clientPhone
      }

      console.warn(`[Voice Webhook] Outbound message ${message.id} has no callable client phone`)
      return null
    }

    console.warn('[Voice Webhook] Could not resolve outbound message for call')
  }

  if (input.to && isValidE164Phone(input.to)) {
    return input.to
  }

  return null
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

async function publishTwilioStatusUpdateEvent(
  messageSid: string,
  status: string,
  errorCode?: string
): Promise<void> {
  try {
    const updatedCaseMessage = await prisma.message.findFirst({
      where: {
        twilioSid: messageSid,
        conversationId: { not: null },
      },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        channel: true,
      },
    })

    if (!updatedCaseMessage?.conversationId) return

    await publishMessageEventFromConversation(updatedCaseMessage.conversationId, {
      id: updatedCaseMessage.id,
      direction: updatedCaseMessage.direction,
      channel: updatedCaseMessage.channel,
      eventType: 'message.status.updated',
      twilioStatus: status,
      twilioErrorCode: errorCode ?? null,
    })
  } catch (error) {
    console.error('[Twilio Status] Realtime publish skipped:', error)
  }
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}, 60000)

/**
 * POST /webhooks/twilio/sms - Handle incoming SMS
 * Twilio sends form-urlencoded data
 */
twilioWebhookRoute.post('/sms', async (c) => {
  // Rate limiting
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    console.warn(`[Twilio Webhook] Rate limit exceeded for ${clientIp}`)
    return c.text('Rate limit exceeded', 429)
  }

  // Get Twilio signature for validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''

  // Reconstruct original URL (handles ngrok/proxy scenarios)
  // Twilio signs using the configured webhook URL, not the internal server URL
  const forwardedProto = c.req.header('x-forwarded-proto') || 'http'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3002'
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  console.log(`[Twilio Webhook] Incoming request - Original URL: ${c.req.url}, Reconstructed URL: ${requestUrl}`)

  // Parse form data (Twilio sends application/x-www-form-urlencoded)
  const formData = await c.req.parseBody()

  // Validate signature
  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn(`[Twilio Webhook] Signature validation failed: ${validationResult.error}`)
    return c.text('Forbidden', 403)
  }

  // Process the incoming message (including all media URLs for MMS)
  const incomingMsg: TwilioIncomingMessage = {
    MessageSid: formData.MessageSid as string,
    AccountSid: formData.AccountSid as string,
    From: formData.From as string,
    To: formData.To as string,
    Body: formData.Body as string,
    NumMedia: formData.NumMedia as string | undefined,
    // Extract all media URLs (Twilio supports up to 10 media items)
    MediaUrl0: formData.MediaUrl0 as string | undefined,
    MediaContentType0: formData.MediaContentType0 as string | undefined,
    MediaUrl1: formData.MediaUrl1 as string | undefined,
    MediaContentType1: formData.MediaContentType1 as string | undefined,
    MediaUrl2: formData.MediaUrl2 as string | undefined,
    MediaContentType2: formData.MediaContentType2 as string | undefined,
    MediaUrl3: formData.MediaUrl3 as string | undefined,
    MediaContentType3: formData.MediaContentType3 as string | undefined,
    MediaUrl4: formData.MediaUrl4 as string | undefined,
    MediaContentType4: formData.MediaContentType4 as string | undefined,
    MediaUrl5: formData.MediaUrl5 as string | undefined,
    MediaContentType5: formData.MediaContentType5 as string | undefined,
    MediaUrl6: formData.MediaUrl6 as string | undefined,
    MediaContentType6: formData.MediaContentType6 as string | undefined,
    MediaUrl7: formData.MediaUrl7 as string | undefined,
    MediaContentType7: formData.MediaContentType7 as string | undefined,
    MediaUrl8: formData.MediaUrl8 as string | undefined,
    MediaContentType8: formData.MediaContentType8 as string | undefined,
    MediaUrl9: formData.MediaUrl9 as string | undefined,
    MediaContentType9: formData.MediaContentType9 as string | undefined,
  }

  const numMedia = parseInt(incomingMsg.NumMedia || '0', 10)
  console.log(`[Twilio Webhook] Incoming SMS from ${incomingMsg.From}${numMedia > 0 ? ` with ${numMedia} media` : ''}`)

  try {
    const result = await processIncomingMessage(incomingMsg)

    if (!result.success) {
      console.warn(`[Twilio Webhook] Processing failed: ${result.error}`)
    } else {
      const target = result.leadId ? `lead ${result.leadId}` : `case ${result.caseId}`
      console.log(`[Twilio Webhook] Message ${result.messageId} recorded for ${target}`)
    }

    // Return TwiML response (empty = no auto-reply)
    return c.text(generateTwimlResponse(), 200, {
      'Content-Type': 'application/xml',
    })
  } catch (error) {
    console.error('[Twilio Webhook] Error processing message:', error)
    // Still return 200 to prevent Twilio retries
    return c.text(generateTwimlResponse(), 200, {
      'Content-Type': 'application/xml',
    })
  }
})

/**
 * POST /webhooks/twilio/status - Handle SMS delivery status updates
 * Twilio sends: queued, sent, delivered, undelivered, failed
 * Also includes ErrorCode and ErrorMessage for failed/undelivered messages
 */
twilioWebhookRoute.post('/status', async (c) => {
  // Rate limiting
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'http'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3002'
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn(`[Twilio Status] Signature validation failed: ${validationResult.error}`)
    return c.text('Forbidden', 403)
  }

  const messageSid = formData.MessageSid as string
  const messageStatus = formData.MessageStatus as string
  const errorCode = formData.ErrorCode as string | undefined
  const errorMessage = formData.ErrorMessage as string | undefined

  console.log(`[Twilio Status] Message ${messageSid}: ${messageStatus}${errorCode ? ` (Error ${errorCode}: ${errorMessage})` : ''}`)

  if (!messageSid) {
    return c.json({ received: true, processed: false })
  }

  try {
    // Build status string - include error details for failed/undelivered
    let statusValue = messageStatus
    if ((messageStatus === 'failed' || messageStatus === 'undelivered') && errorCode) {
      statusValue = `${messageStatus}:${errorCode}:${getTwilioSmsErrorMessage({ errorCode, errorMessage })}`
    }

    // Update Message records (case conversations)
    const updateResult = await prisma.message.updateMany({
      where: { twilioSid: messageSid },
      data: { twilioStatus: statusValue },
    })

    if (updateResult.count > 0) {
      publishTwilioStatusUpdateEvent(messageSid, statusValue, errorCode).catch(() => {})
    }

    // Update SmsSendLog records (bulk lead SMS)
    const smsLogStatus = messageStatus === 'delivered' ? 'DELIVERED'
      : (messageStatus === 'undelivered' || messageStatus === 'failed') ? 'UNDELIVERED'
      : undefined

    let smsLogUpdated = 0
    if (smsLogStatus) {
      // Atomic transaction: update SmsSendLog + Lead status on delivery
      await prisma.$transaction(async (tx) => {
        const smsResult = await tx.smsSendLog.updateMany({
          where: { twilioSid: messageSid },
          data: {
            status: smsLogStatus,
            error: errorCode ? `${errorCode}: ${getTwilioSmsErrorMessage({ errorCode, errorMessage })}` : undefined,
          },
        })
        smsLogUpdated = smsResult.count

        // Update Lead status to CONTACTED on confirmed delivery
        if (smsLogStatus === 'DELIVERED' && smsResult.count > 0) {
          const smsLog = await tx.smsSendLog.findFirst({
            where: { twilioSid: messageSid },
            select: { leadId: true },
          })

          if (smsLog?.leadId) {
            const leadResult = await tx.lead.updateMany({
              where: { id: smsLog.leadId, status: { in: ['NEW', 'SENT'] } },
              data: { status: 'CONTACTED' },
            })

            if (leadResult.count > 0) {
              console.log(`[Twilio Status] Lead ${smsLog.leadId} marked as CONTACTED on delivery`)
            }
          }
        }
      })
    }

    if (updateResult.count === 0 && smsLogUpdated === 0) {
      console.warn(`[Twilio Status] No message found for SID: ${messageSid}`)
    }

    return c.json({ received: true, processed: updateResult.count > 0 || smsLogUpdated > 0 })
  } catch (error) {
    console.error('[Twilio Status] Update error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

// ============================================
// VOICE WEBHOOKS
// ============================================

/**
 * POST /webhooks/twilio/voice - Handle outbound call connection
 * Returns TwiML instructions for call routing with recording
 */
twilioWebhookRoute.post('/voice', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.text('Rate limit exceeded', 429)
  }

  // Get Twilio signature for validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  // Validate signature
  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Voice Webhook] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  // Extract call parameters from Twilio
  const requestedTo = formData.To as string | undefined
  const from = formData.From as string
  const callSid = formData.CallSid as string
  const messageId = formData.messageId as string | undefined
  const caseId = formData.caseId as string | undefined

  const to = await resolveOutboundCallDestination({
    to: requestedTo,
    messageId,
    caseId,
    callSid,
  })

  if (!to) {
    console.warn(`[Voice Webhook] Outbound call ${callSid}: destination unavailable`)
    return c.text(generateEmptyTwimlResponse(), 200, { 'Content-Type': 'application/xml' })
  }

  console.log(`[Voice Webhook] Outbound call ${callSid}: ${from} -> destination resolved`)

  // Generate TwiML response with recording enabled
  const twiml = generateTwimlVoiceResponse({
    to,
    callerId: config.twilio.phoneNumber,
    record: true,
    recordingStatusCallback: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/recording`,
    recordingStatusCallbackEvent: ['completed'],
    statusCallback: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  })

  return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
})

// Max recording duration (Twilio limit is 4 hours = 14400s)
const MAX_RECORDING_DURATION = 14400

/**
 * POST /webhooks/twilio/voice/recording - Handle recording completion
 * Stores recording URL in the call message
 *
 * Twilio Retry Behavior:
 * - Retries up to 3 times on 5xx errors
 * - Exponential backoff: 0s, 15s, 30s
 * - 200/204 response = success, no retry
 */
twilioWebhookRoute.post('/voice/recording', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // Signature validation (SECURITY: prevents fake recording injection)
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Recording Webhook] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const recordingSid = formData.RecordingSid as string
  const recordingUrl = formData.RecordingUrl as string
  const callSid = formData.CallSid as string
  const recordingStatus = formData.RecordingStatus as string

  // Use consistent duration sanitization
  const recordingDuration = sanitizeRecordingDuration(formData.RecordingDuration as string | undefined, MAX_RECORDING_DURATION)

  if (recordingDuration <= 0 && formData.RecordingDuration) {
    console.warn('[Recording Webhook] Invalid duration:', formData.RecordingDuration)
  }

  console.log(`[Recording Webhook] ${recordingSid}: ${recordingStatus}, duration: ${recordingDuration}s`)

  if (recordingStatus !== 'completed') {
    return c.json({ received: true, processed: false })
  }

  try {
    // Transaction for atomic find + update
    const result = await prisma.$transaction(async (tx) => {
      const callMessage = await tx.message.findFirst({
        where: { callSid },
      })

      if (!callMessage) return null

      return await tx.message.update({
        where: { id: callMessage.id },
        data: {
          recordingUrl: `${recordingUrl}.mp3`,
          recordingDuration,
          content: `Call (${formatVoicemailDuration(recordingDuration)})`,
        },
      })
    })

    if (!result) {
      console.warn(`[Recording Webhook] No message found for callSid: ${callSid}`)
      return c.json({ received: true, processed: false, warning: 'MESSAGE_NOT_FOUND' })
    }

    console.log(`[Recording Webhook] Updated message ${result.id} with recording`)
    return c.json({ received: true, processed: true })
  } catch (error) {
    console.error('[Recording Webhook] Error:', error)
    // Return 500 to trigger Twilio retry
    return c.json({ error: 'Processing failed' }, 500)
  }
})

/**
 * POST /webhooks/twilio/voice/status - Handle call status updates
 * Updates call status in message record
 */
twilioWebhookRoute.post('/voice/status', async (c) => {
  // Rate limiting
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // Signature validation (SECURITY: prevents status spoofing)
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Voice Status] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const callSid = formData.CallSid as string
  const callStatus = formData.CallStatus as string
  const callDuration = formData.CallDuration as string | undefined

  console.log(`[Voice Status] ${callSid}: ${callStatus}${callDuration ? `, duration: ${callDuration}s` : ''}`)

  // Update call message status for terminal states
  const terminalStatuses = ['completed', 'busy', 'no-answer', 'failed', 'canceled']
  if (terminalStatuses.includes(callStatus)) {
    try {
      const updateResult = await prisma.message.updateMany({
        where: { callSid },
        data: {
          callStatus,
          // Update content with status if call failed/missed
          ...(callStatus !== 'completed' && {
            content: getCallStatusMessage(callStatus),
          }),
        },
      })

      if (updateResult.count === 0) {
        console.warn(`[Voice Status] No message found for callSid: ${callSid}`)
        return c.json({ received: true, processed: false, warning: 'MESSAGE_NOT_FOUND' })
      }

      return c.json({ received: true, processed: true, count: updateResult.count })
    } catch (error) {
      console.error('[Voice Status] Update error:', error)
      // Return 500 to trigger Twilio retry
      return c.json({ error: 'UPDATE_FAILED' }, 500)
    }
  }

  return c.json({ received: true })
})

/**
 * Get fallback message for call status (English-neutral, frontend handles i18n)
 */
function getCallStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    'busy': 'Call - Busy',
    'no-answer': 'Call - No answer',
    'failed': 'Call - Failed',
    'canceled': 'Call - Canceled',
  }
  return messages[status] || `Call - ${status}`
}

// ============================================
// INCOMING CALL WEBHOOKS
// ============================================

// Default ring timeout before voicemail (seconds)
const RING_TIMEOUT_SECONDS = 30
const PRESENCE_STALE_AFTER_MS = 2 * 60 * 1000

/**
 * POST /webhooks/twilio/voice/incoming - Handle incoming call from customer
 * Routes to org-scoped client managers/admins, then no-staff/missed-call handling if no answer
 */
twilioWebhookRoute.post('/voice/incoming', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.text('Rate limit exceeded', 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Incoming Webhook] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const from = formData.From as string // Caller phone
  const to = formData.To as string     // Twilio number
  const callSid = formData.CallSid as string

  console.log(`[Incoming Webhook] Call ${callSid}: ${from} -> ${to}`)

  try {
    const resolvedOrgId = await resolveIncomingCallOrganizationId(to)

    // 1. Find caller's client and conversation
    const client = resolvedOrgId
      ? await prisma.client.findFirst({
        where: { phone: { in: buildIncomingPhoneCandidates(from) }, organizationId: resolvedOrgId, clientType: 'INDIVIDUAL' },
        include: {
          taxCases: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { conversation: true },
          },
        },
      })
      : null

    // 2. Determine routing based on client assignment
    let staffIdentities: string[] = []

    // Get client's organization for scoping.
    const clientOrgId = client?.organizationId ?? resolvedOrgId

    if (clientOrgId) {
      // Get online staff: admins/managers can receive org-wide calls; staff
      // receive known-client calls when linked, and unknown calls by org.
      const eligibleStaff = client
        ? [
            { role: 'ADMIN' as const },
            { role: 'MANAGER' as const },
            { managedClientLinks: { some: { clientId: client.id } } },
          ]
        : [
            { role: 'ADMIN' as const },
            { role: 'MANAGER' as const },
            { role: 'STAFF' as const },
          ]

      const onlineStaff = await prisma.staffPresence.findMany({
        where: {
          isOnline: true,
          lastSeen: {
            gte: new Date(Date.now() - PRESENCE_STALE_AFTER_MS),
          },
          staff: {
            organizationId: clientOrgId,
            isActive: true,
            OR: eligibleStaff,
          },
        },
        include: { staff: { select: { id: true, role: true } } },
      })

      staffIdentities = onlineStaff
        .map((s) => s.deviceId)
        .filter((id): id is string => Boolean(id))

      console.log(
        `[Incoming Webhook] Org ${clientOrgId} - Client ${client?.id || 'unknown'}, Online eligible: ${staffIdentities.length}`
      )
    } else {
      console.warn(`[Incoming Webhook] Could not resolve org for called number ${to}, using no-staff handling`)
    }

    // 3. Check if any eligible staff online
    if (staffIdentities.length === 0) {
      console.log(`[Incoming Webhook] No eligible staff online, using no-staff handling`)

      const missedCall = clientOrgId
        ? await recordMissedInboundCall({
            callerPhone: from,
            organizationId: clientOrgId,
            callSid,
            callStatus: 'no-answer',
          })
        : null

      if (missedCall) {
        publishMessageEventFromConversation(missedCall.conversationId, {
          id: missedCall.id,
          direction: 'INBOUND',
          channel: 'CALL',
        }).catch(() => {})
      }

      // Fire-and-forget: send missed call text-back SMS
      if (clientOrgId) {
        sendMissedCallTextBack(from, clientOrgId).catch(() => {})
      }

      const twiml = generateNoStaffTwiml({
        voicemailCallbackUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-recording`,
        voicemailCompleteUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-complete`,
      })
      return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
    }

    console.log(`[Incoming Webhook] Routing to ${staffIdentities.length} staff:`, staffIdentities)

    // 4. Create inbound call message record
    // For known clients with existing conversation
    if (client?.taxCases[0]?.conversation) {
      const conversation = client.taxCases[0].conversation
      const callTxResult = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId: conversation.id,
            channel: 'CALL',
            direction: 'INBOUND',
            content: `Incoming call from ${from}`,
            isSystem: false,
            callSid,
            callStatus: 'ringing',
          },
        })

        // Update conversation timestamp
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        })

        return msg
      })

      // Publish realtime event after transaction (non-blocking)
      publishMessageEventFromConversation(conversation.id, {
        id: callTxResult.id,
        direction: 'INBOUND',
        channel: 'CALL',
      }).catch(() => {})
    } else if (isValidE164Phone(from)) {
      // Unknown caller or known client without conversation — create placeholder
      console.log(`[Incoming Webhook] Creating placeholder conversation for unknown caller ${from}`)
      const placeholderConv = await createPlaceholderConversation(from, clientOrgId, 'INCOMING_CALL')

      const unknownCallTxResult = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId: placeholderConv.id,
            channel: 'CALL',
            direction: 'INBOUND',
            content: `Incoming call from ${from}`,
            isSystem: false,
            callSid,
            callStatus: 'ringing',
          },
        })

        await tx.conversation.update({
          where: { id: placeholderConv.id },
          data: { lastMessageAt: new Date() },
        })

        return msg
      })

      // Publish realtime event after transaction (non-blocking)
      publishMessageEventFromConversation(placeholderConv.id, {
        id: unknownCallTxResult.id,
        direction: 'INBOUND',
        channel: 'CALL',
      }).catch(() => {})
    }

    // 5. Generate TwiML to ring staff browsers with recording enabled
    const calledNumber = to
    const twiml = generateIncomingTwiml({
      staffIdentities,
      callerId: from,
      timeout: RING_TIMEOUT_SECONDS,
      dialCompleteUrl: buildVoiceWebhookUrl('/webhooks/twilio/voice/dial-complete', calledNumber),
      record: true,
      recordingStatusCallback: buildVoiceWebhookUrl('/webhooks/twilio/voice/inbound-recording', calledNumber),
    })

    return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
  } catch (error) {
    console.error('[Incoming Webhook] Error:', error)
    // Return no-staff hangup fallback on error.
    const twiml = generateNoStaffTwiml({
      voicemailCallbackUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-recording`,
      voicemailCompleteUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-complete`,
    })
    return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
  }
})

/**
 * POST /webhooks/twilio/voice/dial-complete - Handle dial completion
 * Called after ring timeout or when call is answered/ended
 * Returns no-staff/missed-call TwiML if no-answer, busy, or failed
 */
twilioWebhookRoute.post('/voice/dial-complete', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.text('Rate limit exceeded', 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Dial Complete] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const dialCallStatus = formData.DialCallStatus as string
  const callSid = formData.CallSid as string

  console.log(`[Dial Complete] Call ${callSid}: status=${dialCallStatus}`)

  // Call was answered and completed - return empty response
  if (dialCallStatus === 'completed' || dialCallStatus === 'answered') {
    // Update call message status to completed
    try {
      await prisma.message.updateMany({
        where: { callSid },
        data: { callStatus: 'completed' },
      })
    } catch (error) {
      console.error('[Dial Complete] Failed to update message:', error)
    }

    return c.text(generateEmptyTwimlResponse(), 200, { 'Content-Type': 'application/xml' })
  }

  // No answer, busy, or failed - send missed-call textback and hang up.
  console.log(`[Dial Complete] Call ${callSid} not answered, sending missed-call handling`)

  // Fire-and-forget: send missed call text-back SMS
  // Twilio provides original caller phone in From field of the action callback
  const callerPhone = formData.From as string
  let missedCallRecorded = false
  if (callerPhone) {
    try {
      const callbackOrgId = await resolveIncomingCallOrganizationId(getCalledNumber(c, formData))
      if (callbackOrgId) {
        const missedCall = await recordMissedInboundCall({
          callerPhone,
          organizationId: callbackOrgId,
          callSid,
          callStatus: dialCallStatus,
          content: getCallStatusMessage(dialCallStatus),
        })

        if (missedCall) {
          missedCallRecorded = true
          publishMessageEventFromConversation(missedCall.conversationId, {
            id: missedCall.id,
            direction: 'INBOUND',
            channel: 'CALL',
          }).catch(() => {})
        }

        sendMissedCallTextBack(callerPhone, callbackOrgId).catch(() => {})
      }
    } catch (error) {
      console.error('[Dial Complete] Failed to resolve org for missed-call textback:', error)
    }
  }

  if (!missedCallRecorded) {
    try {
      await prisma.message.updateMany({
        where: { callSid },
        data: {
          callStatus: dialCallStatus,
          content: getCallStatusMessage(dialCallStatus),
        },
      })
    } catch (error) {
      console.error('[Dial Complete] Failed to update message:', error)
    }
  }

  const calledNumber = getCalledNumber(c, formData)
  const twiml = generateVoicemailTwiml({
    voicemailCallbackUrl: buildVoiceWebhookUrl('/webhooks/twilio/voice/voicemail-recording', calledNumber),
    voicemailCompleteUrl: buildVoiceWebhookUrl('/webhooks/twilio/voice/voicemail-complete', calledNumber),
  })

  return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
})

/**
 * POST /webhooks/twilio/voice/voicemail-complete - Handle voicemail recording completion
 * Returns TwiML with goodbye message and hangup - prevents looping
 */
twilioWebhookRoute.post('/voice/voicemail-complete', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.text('Rate limit exceeded', 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Voicemail Complete] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const callSid = formData.CallSid as string
  const recordingDuration = formData.RecordingDuration as string

  console.log(`[Voicemail Complete] Call ${callSid} recording complete, duration: ${recordingDuration || 'unknown'}s`)

  // Return TwiML to say goodbye and hang up (prevents looping)
  const twiml = generateVoicemailCompleteTwiml()
  return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
})

/**
 * POST /webhooks/twilio/voice/inbound-recording - Handle inbound call recording completion
 * Stores recording URL in the inbound call message (for answered calls)
 * Similar to outbound /voice/recording but for inbound calls
 */
twilioWebhookRoute.post('/voice/inbound-recording', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Inbound Recording] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const recordingSid = formData.RecordingSid as string
  const recordingUrl = formData.RecordingUrl as string
  const callSid = formData.CallSid as string
  const recordingStatus = formData.RecordingStatus as string
  const recordingDuration = sanitizeRecordingDuration(formData.RecordingDuration as string | undefined, MAX_RECORDING_DURATION)

  console.log(`[Inbound Recording] ${recordingSid}: status=${recordingStatus}, duration=${recordingDuration}s`)

  if (recordingStatus !== 'completed') {
    return c.json({ received: true, processed: false })
  }

  try {
    // Find the inbound call message by callSid
    const result = await prisma.$transaction(async (tx) => {
      const callMessage = await tx.message.findFirst({
        where: { callSid },
      })

      if (!callMessage) return null

      // Update with recording data
      return await tx.message.update({
        where: { id: callMessage.id },
        data: {
          recordingUrl: `${recordingUrl}.mp3`,
          recordingDuration,
          content: `Call (${formatVoicemailDuration(recordingDuration)})`,
          // Keep callStatus as 'completed' (set by dial-complete)
        },
      })
    })

    if (!result) {
      console.warn(`[Inbound Recording] No message found for callSid: ${callSid}`)
      return c.json({ received: true, processed: false, warning: 'MESSAGE_NOT_FOUND' })
    }

    console.log(`[Inbound Recording] Updated message ${result.id} with recording`)
    return c.json({ received: true, processed: true })
  } catch (error) {
    console.error('[Inbound Recording] Error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

/**
 * POST /webhooks/twilio/voice/voicemail-recording - Handle voicemail recording completion
 * Stores recording URL in the inbound call message
 * Handles unknown callers by creating placeholder conversation
 */
twilioWebhookRoute.post('/voice/voicemail-recording', async (c) => {
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  // Signature validation
  const twilioSignature = c.req.header('X-Twilio-Signature') || ''
  const forwardedProto = c.req.header('x-forwarded-proto') || 'https'
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || ''
  const requestUrl = getWebhookRequestUrl(c, forwardedProto, forwardedHost)

  const formData = await c.req.parseBody()

  const validationResult = validateTwilioSignature(
    requestUrl,
    formData as Record<string, string>,
    twilioSignature
  )

  if (!validationResult.valid) {
    console.warn('[Voicemail Recording] Signature validation failed:', validationResult.error)
    return c.text('Forbidden', 403)
  }

  const recordingSid = formData.RecordingSid as string
  const recordingUrl = formData.RecordingUrl as string
  const callSid = formData.CallSid as string
  const recordingStatus = formData.RecordingStatus as string
  const callerPhone = formData.From as string // Original caller's phone number
  const callbackOrgId = await resolveIncomingCallOrganizationId(getCalledNumber(c, formData))
  const recordingDuration = sanitizeRecordingDuration(formData.RecordingDuration as string | undefined, MAX_RECORDING_DURATION)

  console.log(`[Voicemail Recording] ${recordingSid}: status=${recordingStatus}, duration=${recordingDuration}s, from=${callerPhone}`)

  if (recordingStatus !== 'completed') {
    return c.json({ received: true, processed: false })
  }

  try {
    // Try to find existing message by callSid first
    const existingMessage = await prisma.message.findFirst({
      where: { callSid },
      include: { conversation: true },
    })

    if (existingMessage) {
      const shouldIncrementUnread = !['no-answer', 'busy', 'failed', 'canceled'].includes(existingMessage.callStatus || '')

      // Known caller - update existing message with voicemail recording
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.message.update({
          where: { id: existingMessage.id },
          data: {
            recordingUrl: `${recordingUrl}.mp3`,
            recordingDuration,
            content: `Voicemail (${formatVoicemailDuration(recordingDuration)})`,
            callStatus: 'voicemail',
          },
        })

        // Increment unreadCount on conversation (voicemails are always case-owned,
        // but guard for polymorphic Message.conversationId being nullable).
        if (existingMessage.conversationId) {
          await tx.conversation.update({
            where: { id: existingMessage.conversationId },
            data: {
              lastMessageAt: new Date(),
              ...(shouldIncrementUnread ? { unreadCount: { increment: 1 } } : {}),
            },
          })
        }

        return updated
      })

      console.log(`[Voicemail Recording] Updated message ${result.id} with voicemail, incremented unreadCount`)
      return c.json({ received: true, processed: true })
    }

    // Unknown caller - find or create conversation by phone
    if (!callerPhone) {
      console.warn('[Voicemail Recording] No caller phone and no existing message')
      return c.json({ received: true, processed: false, warning: 'NO_CALLER_INFO' })
    }

    // Validate phone format before attempting database operations
    if (!isValidE164Phone(callerPhone)) {
      console.warn(`[Voicemail Recording] Invalid phone format: ${callerPhone}`)
      return c.json({ received: true, processed: false, warning: 'INVALID_PHONE_FORMAT' })
    }

    if (!callbackOrgId) {
      console.warn('[Voicemail Recording] Could not resolve org for voicemail callback')
      return c.json({ received: true, processed: false, warning: 'ORG_NOT_RESOLVED' })
    }

    // Find existing conversation or create placeholder in the resolved org.
    let conversation = await findConversationByPhone(callerPhone, callbackOrgId)

    if (!conversation) {
      console.log(`[Voicemail Recording] Unknown caller ${callerPhone}, creating placeholder conversation`)
      conversation = await createPlaceholderConversation(callerPhone, callbackOrgId, 'INCOMING_CALL')
    }

    // Create new voicemail message
    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: conversation!.id,
          channel: 'CALL',
          direction: 'INBOUND',
          content: `Voicemail (${formatVoicemailDuration(recordingDuration)})`,
          isSystem: false,
          callSid,
          recordingUrl: `${recordingUrl}.mp3`,
          recordingDuration,
          callStatus: 'voicemail',
        },
      })

      // Update conversation with new message and increment unreadCount
      await tx.conversation.update({
        where: { id: conversation!.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      })

      return message
    })

    // Publish realtime event after transaction (non-blocking)
    publishMessageEventFromConversation(conversation!.id, {
      id: result.id,
      direction: 'INBOUND',
      channel: 'CALL',
    }).catch(() => {})

    console.log(`[Voicemail Recording] Created voicemail message ${result.id} for caller ${callerPhone}`)
    return c.json({ received: true, processed: true, created: true })
  } catch (error) {
    console.error('[Voicemail Recording] Error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

export { twilioWebhookRoute }
