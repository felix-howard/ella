/**
 * Twilio Webhook Route
 * Handles incoming SMS messages and voice call webhooks from Twilio
 */
import { Hono } from 'hono'
import {
  processIncomingMessage,
  validateTwilioSignature,
  generateTwimlResponse,
  type TwilioIncomingMessage,
} from '../../services/sms'
import { generateTwimlVoiceResponse, generateEmptyTwimlResponse } from '../../services/voice'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'

const twilioWebhookRoute = new Hono()

// Simple in-memory rate limiter for webhook endpoint
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60 // 60 requests per minute per IP

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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
      console.log(
        `[Twilio Webhook] Message ${result.messageId} recorded for case ${result.caseId}`
      )
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
 * POST /webhooks/twilio/status - Handle message status updates
 * Optional: track delivery status of outbound messages
 */
twilioWebhookRoute.post('/status', async (c) => {
  // Rate limiting
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  const formData = await c.req.parseBody()

  const messageSid = formData.MessageSid as string
  const messageStatus = formData.MessageStatus as string

  console.log(`[Twilio Status] Message ${messageSid}: ${messageStatus}`)

  // Could update message record with delivery status here
  // For now, just acknowledge
  return c.json({ received: true })
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
  const to = formData.To as string
  const from = formData.From as string
  const callSid = formData.CallSid as string

  console.log(`[Voice Webhook] Outbound call ${callSid}: ${from} -> ${to}`)

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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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

  // Validate and clamp duration
  const rawDuration = parseInt(formData.RecordingDuration as string || '0', 10)
  const recordingDuration = Math.min(Math.max(rawDuration, 0), MAX_RECORDING_DURATION)

  if (rawDuration <= 0) {
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
          content: `Cuộc gọi (${formatDuration(recordingDuration)})`,
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get Vietnamese message for call status
 */
function getCallStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    'busy': 'Cuộc gọi - Máy bận',
    'no-answer': 'Cuộc gọi - Không trả lời',
    'failed': 'Cuộc gọi - Thất bại',
    'canceled': 'Cuộc gọi - Đã hủy',
  }
  return messages[status] || `Cuộc gọi - ${status}`
}

export { twilioWebhookRoute }
