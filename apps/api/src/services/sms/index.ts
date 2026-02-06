/**
 * SMS Services Index
 * Re-exports all SMS-related functionality
 */

// Twilio client
export {
  getTwilioClient,
  isTwilioConfigured,
  sendSms,
  isValidPhoneNumber,
  formatPhoneToE164,
  type SendSmsOptions,
  type SendSmsResult,
} from './twilio-client'

// Message sender
export {
  sendWelcomeMessage,
  sendMissingDocsReminder,
  sendBlurryResendRequest,
  sendDocsCompleteMessage,
  sendCustomMessage,
  sendSmsOnly,
  isSmsEnabled,
  getOrgSmsLanguage,
  type SendMessageResult,
} from './message-sender'

// Webhook handler
export {
  processIncomingMessage,
  validateTwilioSignature,
  generateTwimlResponse,
  type TwilioIncomingMessage,
  type ProcessIncomingResult,
  type SignatureValidationResult,
} from './webhook-handler'

// Templates
export * from './templates'

// Notification service (automated SMS)
export {
  notifyBlurryDocument,
  notifyMissingDocuments,
  getCasesNeedingReminders,
  sendBatchMissingReminders,
} from './notification-service'
