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
import {
  generateTwimlVoiceResponse,
  generateEmptyTwimlResponse,
  generateIncomingTwiml,
  generateNoStaffTwiml,
  generateVoicemailTwiml,
  generateVoicemailCompleteTwiml,
  findConversationByPhone,
  createPlaceholderConversation,
  formatVoicemailDuration,
  isValidE164Phone,
  sanitizeRecordingDuration,
} from '../../services/voice'
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
          content: `Cuộc gọi (${formatVoicemailDuration(recordingDuration)})`,
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

// ============================================
// INCOMING CALL WEBHOOKS
// ============================================

// Default ring timeout before voicemail (seconds)
const RING_TIMEOUT_SECONDS = 30

/**
 * POST /webhooks/twilio/voice/incoming - Handle incoming call from customer
 * Routes to last-contact staff or all online staff, then voicemail if no answer
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
    // 1. Find caller's client and conversation
    const client = await prisma.client.findUnique({
      where: { phone: from },
      include: {
        taxCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { conversation: true },
        },
      },
    })

    // 2. Determine routing - find last-contact staff or all online staff
    let staffIdentities: string[] = []

    // Future: Route to last-contact staff if we track staffId on messages
    // For now, route to all online staff

    // 3. Get online staff
    const onlineStaff = await prisma.staffPresence.findMany({
      where: { isOnline: true },
    })

    if (onlineStaff.length === 0) {
      // No staff online - go directly to voicemail
      console.log(`[Incoming Webhook] No staff online, routing to voicemail`)
      const twiml = generateNoStaffTwiml({
        voicemailCallbackUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-recording`,
        voicemailCompleteUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-complete`,
      })
      return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
    }

    // Build staff identities from deviceId (e.g., "staff_123")
    staffIdentities = onlineStaff
      .map((s) => s.deviceId)
      .filter((id): id is string => Boolean(id))

    console.log(`[Incoming Webhook] Routing to ${staffIdentities.length} online staff:`, staffIdentities)

    // 4. Create inbound call message record (atomic transaction)
    if (client?.taxCases[0]?.conversation) {
      const conversation = client.taxCases[0].conversation
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            channel: 'CALL',
            direction: 'INBOUND',
            content: `Cuộc gọi đến từ ${from}`,
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
      })
    }

    // 5. Generate TwiML to ring staff browsers with recording enabled
    const twiml = generateIncomingTwiml({
      staffIdentities,
      callerId: from,
      timeout: RING_TIMEOUT_SECONDS,
      dialCompleteUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/dial-complete`,
      record: true,
      recordingStatusCallback: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/inbound-recording`,
    })

    return c.text(twiml, 200, { 'Content-Type': 'application/xml' })
  } catch (error) {
    console.error('[Incoming Webhook] Error:', error)
    // Return voicemail as fallback on error
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
 * Routes to voicemail if no-answer, busy, or failed
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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

  // No answer, busy, or failed - route to voicemail
  console.log(`[Dial Complete] Call ${callSid} not answered, routing to voicemail`)

  // Update call message status
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

  const twiml = generateVoicemailTwiml({
    voicemailCallbackUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-recording`,
    voicemailCompleteUrl: `${config.twilio.webhookBaseUrl}/webhooks/twilio/voice/voicemail-complete`,
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
          content: `Cuộc gọi (${formatVoicemailDuration(recordingDuration)})`,
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
  const urlPath = new URL(c.req.url).pathname
  const requestUrl = `${forwardedProto}://${forwardedHost}${urlPath}`

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
      // Known caller - update existing message with voicemail recording
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.message.update({
          where: { id: existingMessage.id },
          data: {
            recordingUrl: `${recordingUrl}.mp3`,
            recordingDuration,
            content: `Tin nhắn thoại (${formatVoicemailDuration(recordingDuration)})`,
            callStatus: 'voicemail',
          },
        })

        // Increment unreadCount on conversation
        await tx.conversation.update({
          where: { id: existingMessage.conversationId },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
          },
        })

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

    // Find existing conversation or create placeholder
    let conversation = await findConversationByPhone(callerPhone)

    if (!conversation) {
      console.log(`[Voicemail Recording] Unknown caller ${callerPhone}, creating placeholder conversation`)
      conversation = await createPlaceholderConversation(callerPhone)
    }

    // Create new voicemail message
    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: conversation!.id,
          channel: 'CALL',
          direction: 'INBOUND',
          content: `Tin nhắn thoại (${formatVoicemailDuration(recordingDuration)})`,
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

    console.log(`[Voicemail Recording] Created voicemail message ${result.id} for caller ${callerPhone}`)
    return c.json({ received: true, processed: true, created: true })
  } catch (error) {
    console.error('[Voicemail Recording] Error:', error)
    return c.json({ error: 'Processing failed' }, 500)
  }
})

export { twilioWebhookRoute }
