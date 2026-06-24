const UNKNOWN_ERROR_MESSAGES = new Set(['', 'unknown error', 'unknownerror'])

const TWILIO_SMS_ERROR_DESCRIPTIONS: Record<string, string> = {
  '21211': 'The destination phone number is not a valid phone number.',
  '21408': 'SMS is not enabled for this destination or region.',
  '21610': 'The recipient opted out of messages from this sender. They must reply START before messages can resume.',
  '21612': 'The destination number cannot receive SMS, commonly because it is a landline or unsupported carrier route.',
  '21614': 'The destination number is not a valid mobile number for SMS delivery.',
  '30003': 'The destination handset is unreachable, powered off, out of service, or temporarily unable to receive SMS.',
  '30005': 'The destination number is unknown or may no longer exist.',
  '30006': 'The destination number is a landline or unreachable carrier route.',
  '30007': 'The message was filtered or blocked by Twilio or the carrier.',
  '30008': 'Twilio or the carrier returned a generic delivery failure. The handset may be unavailable, roaming, or blocked on that carrier route.',
}

export function normalizeTwilioErrorCode(errorCode: string | number | null | undefined): string | undefined {
  if (errorCode === null || errorCode === undefined) return undefined
  const normalized = String(errorCode).trim()
  return normalized ? normalized : undefined
}

export function isUnknownTwilioErrorMessage(errorMessage: string | null | undefined): boolean {
  const normalized = (errorMessage ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return UNKNOWN_ERROR_MESSAGES.has(normalized) || UNKNOWN_ERROR_MESSAGES.has(normalized.replace(/\s+/g, ''))
}

export function getTwilioSmsErrorDescription(errorCode: string | number | null | undefined): string | undefined {
  const normalized = normalizeTwilioErrorCode(errorCode)
  return normalized ? TWILIO_SMS_ERROR_DESCRIPTIONS[normalized] : undefined
}

export function getTwilioSmsErrorMessage(input: {
  errorCode?: string | number | null
  errorMessage?: string | null
}): string {
  const rawMessage = input.errorMessage?.trim()
  if (rawMessage && !isUnknownTwilioErrorMessage(rawMessage)) {
    return rawMessage
  }

  const description = getTwilioSmsErrorDescription(input.errorCode)
  if (description) return description

  return normalizeTwilioErrorCode(input.errorCode)
    ? 'Twilio did not provide a specific description for this delivery error.'
    : 'Twilio did not provide a specific delivery error.'
}

export function formatTwilioSmsFailureDetails(input: {
  errorCode?: string | number | null
  errorMessage?: string | null
}): string {
  const code = normalizeTwilioErrorCode(input.errorCode)
  const message = getTwilioSmsErrorMessage(input)
  return code ? `Twilio ${code}: ${message}` : message
}
