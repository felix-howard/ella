/**
 * TwiML Voice Response Generator
 * Generates TwiML XML for Twilio voice call routing
 */

export interface TwimlVoiceOptions {
  /** Phone number to dial (E.164 format) */
  to: string
  /** Caller ID to display (must be verified Twilio number) */
  callerId: string
  /** Enable call recording */
  record: boolean
  /** Webhook URL for recording status callbacks */
  recordingStatusCallback?: string
  /** Events to receive recording callbacks for */
  recordingStatusCallbackEvent?: string[]
  /** Webhook URL for call status callbacks */
  statusCallback?: string
  /** Events to receive call status callbacks for */
  statusCallbackEvent?: string[]
}

/**
 * Generate TwiML response for outbound voice call
 * Includes <Dial> with recording and status callback options
 */
export function generateTwimlVoiceResponse(options: TwimlVoiceOptions): string {
  // Build Dial attributes
  const dialAttrs: string[] = [`callerId="${escapeXml(options.callerId)}"`]

  // Recording settings (record both sides from answer)
  if (options.record) {
    dialAttrs.push('record="record-from-answer-dual"')

    if (options.recordingStatusCallback) {
      dialAttrs.push(`recordingStatusCallback="${escapeXml(options.recordingStatusCallback)}"`)
      const events = options.recordingStatusCallbackEvent?.join(' ') || 'completed'
      dialAttrs.push(`recordingStatusCallbackEvent="${events}"`)
    }
  }

  // Call status callbacks
  if (options.statusCallback) {
    dialAttrs.push(`statusCallback="${escapeXml(options.statusCallback)}"`)
    const events = options.statusCallbackEvent?.join(' ') || 'completed'
    dialAttrs.push(`statusCallbackEvent="${events}"`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs.join(' ')}>
    <Number>${escapeXml(options.to)}</Number>
  </Dial>
</Response>`
}

/**
 * Generate empty TwiML response (for acknowledgment)
 */
export function generateEmptyTwimlResponse(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`
}

/**
 * Escape XML special characters for TwiML safety
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
