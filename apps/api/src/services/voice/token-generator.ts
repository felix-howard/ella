/**
 * Twilio Voice Access Token Generator
 * Generates JWT tokens for browser-based voice calls using Twilio Client SDK
 */
import { jwt } from 'twilio'
import { config } from '../../lib/config'

const { AccessToken } = jwt
const VoiceGrant = AccessToken.VoiceGrant

export interface VoiceTokenOptions {
  /** Unique user identifier (typically staffId prefixed) */
  identity: string
}

export interface VoiceTokenResult {
  token: string
  expiresIn: number
  identity: string
}

/**
 * Generate Twilio Access Token with VoiceGrant for browser-based calls
 * Token allows outbound calls only (no incoming)
 */
export function generateVoiceToken(options: VoiceTokenOptions): VoiceTokenResult {
  if (!config.twilio.voiceConfigured) {
    throw new Error('Twilio Voice not configured. Check API Key and TwiML App settings.')
  }

  // SECURITY: Require non-empty identity for audit trail
  if (!options.identity || options.identity.trim().length === 0) {
    throw new Error('Identity required for voice token')
  }

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: config.twilio.twimlAppSid,
    incomingAllow: false, // Staff-initiated calls only, no incoming
  })

  const token = new AccessToken(
    config.twilio.accountSid,
    config.twilio.apiKeySid,
    config.twilio.apiKeySecret,
    {
      identity: options.identity,
      ttl: 3600, // 1 hour
    }
  )

  token.addGrant(voiceGrant)

  return {
    token: token.toJwt(),
    expiresIn: 3600,
    identity: options.identity,
  }
}

/**
 * Check if Twilio Voice is configured and available
 */
export function isVoiceConfigured(): boolean {
  return config.twilio.voiceConfigured
}
