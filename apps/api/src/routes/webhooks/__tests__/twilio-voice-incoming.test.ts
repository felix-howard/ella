import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  organization: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  staffPresence: {
    findMany: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  conversation: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const smsMocks = vi.hoisted(() => ({
  validateTwilioSignature: vi.fn(),
  processIncomingMessage: vi.fn(),
  generateTwimlResponse: vi.fn(),
  sendMissedCallTextBack: vi.fn(),
}))

const voiceMocks = vi.hoisted(() => ({
  generateTwimlVoiceResponse: vi.fn(),
  generateEmptyTwimlResponse: vi.fn(),
  generateIncomingTwiml: vi.fn(),
  generateNoStaffTwiml: vi.fn(),
  generateVoicemailTwiml: vi.fn(),
  generateVoicemailCompleteTwiml: vi.fn(),
  findConversationByPhone: vi.fn(),
  createPlaceholderConversation: vi.fn(),
  formatVoicemailDuration: vi.fn(),
  isValidE164Phone: vi.fn(),
  sanitizeRecordingDuration: vi.fn(),
}))

const realtimeMocks = vi.hoisted(() => ({
  publishMessageEventFromConversation: vi.fn(),
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: {
      phoneNumber: '+15550000000',
      webhookBaseUrl: 'https://api.example.test',
      authToken: 'auth-token',
    },
  },
}))

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

vi.mock('../../../services/sms', () => ({
  processIncomingMessage: smsMocks.processIncomingMessage,
  validateTwilioSignature: smsMocks.validateTwilioSignature,
  generateTwimlResponse: smsMocks.generateTwimlResponse,
  sendMissedCallTextBack: smsMocks.sendMissedCallTextBack,
}))

vi.mock('../../../services/voice', () => ({
  generateTwimlVoiceResponse: voiceMocks.generateTwimlVoiceResponse,
  generateEmptyTwimlResponse: voiceMocks.generateEmptyTwimlResponse,
  generateIncomingTwiml: voiceMocks.generateIncomingTwiml,
  generateNoStaffTwiml: voiceMocks.generateNoStaffTwiml,
  generateVoicemailTwiml: voiceMocks.generateVoicemailTwiml,
  generateVoicemailCompleteTwiml: voiceMocks.generateVoicemailCompleteTwiml,
  findConversationByPhone: voiceMocks.findConversationByPhone,
  createPlaceholderConversation: voiceMocks.createPlaceholderConversation,
  formatVoicemailDuration: voiceMocks.formatVoicemailDuration,
  isValidE164Phone: voiceMocks.isValidE164Phone,
  sanitizeRecordingDuration: voiceMocks.sanitizeRecordingDuration,
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromConversation: realtimeMocks.publishMessageEventFromConversation,
}))

import { twilioWebhookRoute } from '../twilio'

function createApp() {
  const app = new Hono()
  app.route('/webhooks/twilio', twilioWebhookRoute)
  return app
}

async function postIncomingCall(input: { from?: string; to?: string; ip?: string } = {}) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
    To: input.to ?? '+15550000001',
    CallSid: 'CA_test',
  })

  return createApp().request('/webhooks/twilio/voice/incoming', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

async function postVoicemailRecording(input: {
  from?: string
  to?: string
  calledNumber?: string
  includeTo?: boolean
  ip?: string
} = {}) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
    CallSid: 'CA_voicemail',
    RecordingSid: 'RE_test',
    RecordingUrl: 'https://recordings.example.test/RE_test',
    RecordingStatus: 'completed',
    RecordingDuration: '12',
  })

  if (input.includeTo !== false) {
    body.set('To', input.to ?? '+15559990000')
  }

  const query = input.calledNumber
    ? `?calledNumber=${encodeURIComponent(input.calledNumber)}`
    : ''

  return createApp().request(`/webhooks/twilio/voice/voicemail-recording${query}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.1.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

async function postDialComplete(input: {
  from?: string
  calledNumber?: string
  dialStatus?: string
  includeTo?: boolean
  ip?: string
} = {}) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
    CallSid: 'CA_test',
    DialCallStatus: input.dialStatus ?? 'no-answer',
  })

  if (input.includeTo) {
    body.set('To', input.calledNumber ?? '+15550000001')
  }

  const query = input.calledNumber
    ? `?calledNumber=${encodeURIComponent(input.calledNumber)}`
    : ''

  return createApp().request(`/webhooks/twilio/voice/dial-complete${query}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.2.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

describe('Twilio voice incoming webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smsMocks.validateTwilioSignature.mockReturnValue({ valid: true })
    smsMocks.sendMissedCallTextBack.mockResolvedValue(undefined)
    realtimeMocks.publishMessageEventFromConversation.mockResolvedValue(undefined)
    voiceMocks.isValidE164Phone.mockImplementation((phone: string) => /^\+[1-9]\d{9,14}$/.test(phone))
    voiceMocks.generateNoStaffTwiml.mockReturnValue('<Response><Say>Voicemail</Say></Response>')
    voiceMocks.generateVoicemailTwiml.mockReturnValue('<Response><Hangup /></Response>')
    voiceMocks.sanitizeRecordingDuration.mockReturnValue(12)
    voiceMocks.formatVoicemailDuration.mockReturnValue('0:12')
    voiceMocks.generateIncomingTwiml.mockImplementation(({ staffIdentities }) =>
      `<Response>${staffIdentities.join(',')}</Response>`
    )
    voiceMocks.createPlaceholderConversation.mockResolvedValue({ id: 'conversation_unknown' })
    prismaMocks.message.findFirst.mockResolvedValue(null)
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          create: vi.fn().mockResolvedValue({ id: 'message_1' }),
        },
        conversation: {
          update: vi.fn().mockResolvedValue({ id: 'conversation_unknown' }),
        },
      })
    )
  })

  it('scopes known caller lookup to the organization resolved from the called number', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_a',
      organizationId: 'org_a',
      taxCases: [],
    })
    prismaMocks.staffPresence.findMany.mockResolvedValue([])

    const res = await postIncomingCall({ from: '+15551112222', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: '+15551112222', organizationId: 'org_a', clientType: 'INDIVIDUAL' },
    }))
    expect(prismaMocks.staffPresence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        staff: expect.objectContaining({
          organizationId: 'org_a',
          OR: [
            { managedClientLinks: { some: { clientId: 'client_a' } } },
            { role: 'ADMIN' },
          ],
        }),
      }),
    }))
  })

  it('routes unresolved called numbers to voicemail without ringing cross-tenant staff', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([])

    const res = await postIncomingCall({ to: '+15559990000' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Voicemail')
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('does not fall back from configured Twilio number to the only active organization', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([])

    const res = await postIncomingCall({ to: '+15550000000' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Voicemail')
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('routes ambiguous called numbers to voicemail without tenant lookups', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([
      { id: 'org_a' },
      { id: 'org_b' },
    ])

    const res = await postIncomingCall({ to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Voicemail')
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('routes unknown callers only to admins in the resolved organization', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue(null)
    prismaMocks.staffPresence.findMany.mockResolvedValue([
      { deviceId: 'staff_admin_device', staff: { id: 'staff_admin', role: 'ADMIN' } },
    ])

    const res = await postIncomingCall({ from: '+15553334444', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('staff_admin_device')
    expect(prismaMocks.staffPresence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        staff: expect.objectContaining({
          organizationId: 'org_a',
          OR: [{ role: 'ADMIN' }],
        }),
      }),
    }))
    expect(voiceMocks.createPlaceholderConversation).toHaveBeenCalledWith(
      '+15553334444',
      'org_a',
      'INCOMING_CALL'
    )
    const incomingOptions = voiceMocks.generateIncomingTwiml.mock.calls[0][0]
    expect(new URL(incomingOptions.dialCompleteUrl).searchParams.get('calledNumber')).toBe('+15550000001')
    expect(new URL(incomingOptions.recordingStatusCallback).searchParams.get('calledNumber')).toBe('+15550000001')
  })

  it('uses calledNumber query context for dial-complete missed-call textback', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.message.updateMany.mockResolvedValue({ count: 1 })

    const res = await postDialComplete({
      from: '+15551112222',
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(smsMocks.validateTwilioSignature).toHaveBeenCalledWith(
      'https://api.example.test/webhooks/twilio/voice/dial-complete?calledNumber=%2B15550000001',
      expect.any(Object),
      'valid'
    )
    expect(smsMocks.sendMissedCallTextBack).toHaveBeenCalledWith('+15551112222', 'org_a')
    expect(voiceMocks.generateVoicemailTwiml).toHaveBeenCalledWith({
      voicemailCallbackUrl: expect.stringContaining('calledNumber=%2B15550000001'),
      voicemailCompleteUrl: expect.stringContaining('calledNumber=%2B15550000001'),
    })
  })

  it('still returns dial-complete TwiML if missed-call org lookup fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMocks.organization.findMany.mockRejectedValueOnce(new Error('database unavailable'))
    prismaMocks.message.updateMany.mockResolvedValue({ count: 1 })

    const res = await postDialComplete({
      from: '+15551112222',
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<Response>')
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      '[Dial Complete] Failed to resolve org for missed-call textback:',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })

  it('does not persist voicemail callbacks when the called number cannot resolve an organization', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([])

    const res = await postVoicemailRecording({ from: '+15554445555', to: '+15559990000' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      received: true,
      processed: false,
      warning: 'ORG_NOT_RESOLVED',
    })
    expect(voiceMocks.findConversationByPhone).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
  })

  it('uses calledNumber query context for voicemail callback persistence', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    voiceMocks.findConversationByPhone.mockResolvedValue({ id: 'conversation_existing' })

    const res = await postVoicemailRecording({
      from: '+15554445555',
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, processed: true, created: true })
    expect(smsMocks.validateTwilioSignature).toHaveBeenCalledWith(
      'https://api.example.test/webhooks/twilio/voice/voicemail-recording?calledNumber=%2B15550000001',
      expect.any(Object),
      'valid'
    )
    expect(voiceMocks.findConversationByPhone).toHaveBeenCalledWith('+15554445555', 'org_a')
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
  })
})
