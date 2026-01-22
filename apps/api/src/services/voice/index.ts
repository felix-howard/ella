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

// TwiML generator - outbound calls
export {
  generateTwimlVoiceResponse,
  generateEmptyTwimlResponse,
  type TwimlVoiceOptions,
} from './twiml-generator'

// TwiML generator - incoming calls
export {
  generateIncomingTwiml,
  generateNoStaffTwiml,
  generateVoicemailTwiml,
  type TwimlIncomingOptions,
  type TwimlVoicemailOptions,
} from './twiml-generator'

// Voicemail helpers
export {
  findConversationByPhone,
  createPlaceholderConversation,
  formatVoicemailDuration,
  isValidE164Phone,
  sanitizePhone,
  sanitizeRecordingDuration,
} from './voicemail-helpers'
