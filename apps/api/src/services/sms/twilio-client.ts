/**
 * Twilio Client Wrapper
 * Provides SMS sending capabilities with retry logic and error handling
 */
import Twilio from 'twilio'
import { config } from '../../lib/config'

// Twilio client singleton
let twilioClient: Twilio.Twilio | null = null

/**
 * Get or create Twilio client instance
 */
export function getTwilioClient(): Twilio.Twilio {
  if (!config.twilio.isConfigured) {
    throw new Error('Twilio is not configured. Missing environment variables.')
  }

  if (!twilioClient) {
    twilioClient = Twilio(config.twilio.accountSid, config.twilio.authToken)
  }

  return twilioClient
}

/**
 * Check if Twilio is configured and available
 */
export function isTwilioConfigured(): boolean {
  return config.twilio.isConfigured
}

export interface SendSmsOptions {
  to: string
  body: string
  statusCallback?: string
}

export interface SendSmsResult {
  success: boolean
  sid?: string
  error?: string
  status?: string
}

/**
 * Send SMS message via Twilio
 * Includes retry logic for transient failures
 */
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  if (!config.twilio.isConfigured) {
    console.warn('[Twilio] Not configured - SMS will not be sent')
    return { success: false, error: 'TWILIO_NOT_CONFIGURED' }
  }

  const client = getTwilioClient()
  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await client.messages.create({
        to: options.to,
        from: config.twilio.phoneNumber,
        body: options.body,
        statusCallback: options.statusCallback,
      })

      return {
        success: true,
        sid: message.sid,
        status: message.status,
      }
    } catch (error) {
      lastError = error as Error
      const errorCode = (error as { code?: number })?.code

      // Don't retry on certain error codes (invalid number, etc.)
      if (
        errorCode === 21211 || // Invalid 'To' phone number
        errorCode === 21614 || // 'To' number not verified
        errorCode === 21408    // Permission to send SMS not enabled
      ) {
        return {
          success: false,
          error: `TWILIO_ERROR_${errorCode}`,
        }
      }

      // Retry on transient failures
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500 // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'TWILIO_SEND_FAILED',
  }
}

/**
 * Validate phone number format (basic E.164 check)
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][number], 10-15 digits total
  const e164Regex = /^\+[1-9]\d{9,14}$/
  return e164Regex.test(phone)
}

/**
 * Format phone number to E.164 if possible
 * Assumes US number if no country code
 */
export function formatPhoneToE164(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // If no +, assume US and add +1
  if (!cleaned.startsWith('+')) {
    // Remove leading 1 if present for US numbers
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1)
    }
    // Add +1 for US
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned
    }
  }

  return cleaned
}
