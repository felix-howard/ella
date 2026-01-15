/**
 * Twilio Webhook Route
 * Handles incoming SMS messages from Twilio
 */
import { Hono } from 'hono'
import {
  processIncomingMessage,
  validateTwilioSignature,
  generateTwimlResponse,
  type TwilioIncomingMessage,
} from '../../services/sms'

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
  const forwardedHost = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost:3001'
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

  // Process the incoming message
  const incomingMsg: TwilioIncomingMessage = {
    MessageSid: formData.MessageSid as string,
    AccountSid: formData.AccountSid as string,
    From: formData.From as string,
    To: formData.To as string,
    Body: formData.Body as string,
    NumMedia: formData.NumMedia as string | undefined,
    MediaUrl0: formData.MediaUrl0 as string | undefined,
    MediaContentType0: formData.MediaContentType0 as string | undefined,
  }

  console.log(`[Twilio Webhook] Incoming SMS from ${incomingMsg.From}`)

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

export { twilioWebhookRoute }
