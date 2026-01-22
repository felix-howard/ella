/**
 * TwiML Voice Response Generator
 * Generates TwiML XML for Twilio voice call routing
 */

// ============================================
// OUTBOUND CALL TYPES
// ============================================

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

// ============================================
// INCOMING CALL TYPES
// ============================================

export interface TwimlIncomingOptions {
  /** Staff device identities to ring (e.g., ["staff_123", "staff_456"]) */
  staffIdentities: string[]
  /** Caller phone number (From) for logging */
  callerId: string
  /** Ring timeout in seconds (default 30) */
  timeout: number
  /** Webhook URL for dial completion status */
  dialCompleteUrl: string
  /** Enable call recording (default true) */
  record?: boolean
  /** Webhook URL for recording status callbacks */
  recordingStatusCallback?: string
}

export interface TwimlVoicemailOptions {
  /** Webhook URL for recording completion callback */
  voicemailCallbackUrl: string
  /** Max recording duration in seconds (default 120) */
  maxLength?: number
}

// ============================================
// INCOMING CALL TWIML GENERATORS
// ============================================

/**
 * Generate TwiML for incoming call - rings staff browsers
 * Uses <Dial> with multiple <Client> nouns for parallel ring
 * Includes recording settings for inbound call recordings
 */
export function generateIncomingTwiml(options: TwimlIncomingOptions): string {
  const { staffIdentities, timeout, dialCompleteUrl, record = true, recordingStatusCallback } = options

  // Build Dial attributes
  const dialAttrs: string[] = [
    `timeout="${timeout}"`,
    `action="${escapeXml(dialCompleteUrl)}"`,
    'method="POST"',
    'answerOnBridge="true"',
  ]

  // Add recording settings (record both sides from answer)
  if (record) {
    dialAttrs.push('record="record-from-answer-dual"')

    if (recordingStatusCallback) {
      dialAttrs.push(`recordingStatusCallback="${escapeXml(recordingStatusCallback)}"`)
      dialAttrs.push('recordingStatusCallbackEvent="completed"')
    }
  }

  // Build Client nouns for each staff identity (max 10 per Twilio docs)
  const clientNouns = staffIdentities
    .slice(0, 10)
    .map((id) => `    <Client>${escapeXml(id)}</Client>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs.join(' ')}>
${clientNouns}
  </Dial>
</Response>`
}

/**
 * Generate TwiML when no staff are online
 * Plays message and redirects to voicemail
 */
export function generateNoStaffTwiml(voicemailOptions: TwimlVoicemailOptions): string {
  const { voicemailCallbackUrl, maxLength = 120 } = voicemailOptions

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.vi-VN-Wavenet-A" language="vi-VN">Xin chào, hiện không có nhân viên trực. Xin vui lòng để lại tin nhắn sau tiếng bíp.</Say>
  <Record maxLength="${maxLength}" action="${escapeXml(voicemailCallbackUrl)}" method="POST" playBeep="true" />
  <Say voice="Google.vi-VN-Wavenet-A" language="vi-VN">Không nhận được tin nhắn. Tạm biệt.</Say>
</Response>`
}

/**
 * Generate TwiML for voicemail (after dial timeout)
 * Vietnamese prompt with recording
 */
export function generateVoicemailTwiml(options: TwimlVoicemailOptions): string {
  const { voicemailCallbackUrl, maxLength = 120 } = options

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.vi-VN-Wavenet-A" language="vi-VN">Nhân viên của chúng tôi hiện không thể nhận cuộc gọi. Xin vui lòng để lại tin nhắn sau tiếng bíp.</Say>
  <Record maxLength="${maxLength}" action="${escapeXml(voicemailCallbackUrl)}" method="POST" playBeep="true" />
  <Say voice="Google.vi-VN-Wavenet-A" language="vi-VN">Không nhận được tin nhắn. Tạm biệt.</Say>
</Response>`
}
