/**
 * Voice Services Index
 * Re-exports all voice-related functionality
 */

// Token generator
export {
  generateVoiceToken,
  isVoiceConfigured,
  type VoiceTokenOptions,
  type VoiceTokenResult,
} from './token-generator'

// TwiML generator
export {
  generateTwimlVoiceResponse,
  generateEmptyTwimlResponse,
  type TwimlVoiceOptions,
} from './twiml-generator'
