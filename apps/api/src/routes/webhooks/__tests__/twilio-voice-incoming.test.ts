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
    update: vi.fn(),
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
  findLeadByPhone: vi.fn(),
}))

const voiceMocks = vi.hoisted(() => ({
  generateTwimlVoiceResponse: vi.fn(),
  generateEmptyTwimlResponse: vi.fn(),
  generateIncomingTwiml: vi.fn(),
  generateUnknownCallerGateTwiml: vi.fn(),
  generateInvalidGateTwiml: vi.fn(),
  generateNoStaffTwiml: vi.fn(),
  generateVoicemailTwiml: vi.fn(),
  generateVoicemailCompleteTwiml: vi.fn(),
  findConversationByPhone: vi.fn(),
  createPlaceholderConversation: vi.fn(),
  recordMissedInboundCall: vi.fn(),
  recordRingingInboundCall: vi.fn(),
  recordVoicemailInboundCall: vi.fn(),
  createLeadInboundCallMessage: vi.fn(),
  updateLeadCallMessageBySid: vi.fn(),
  upsertLeadMissedCallMessage: vi.fn(),
  formatVoicemailDuration: vi.fn(),
  isValidE164Phone: vi.fn(),
  sanitizeRecordingDuration: vi.fn(),
}))

const realtimeMocks = vi.hoisted(() => ({
  publishMessageEventFromConversation: vi.fn(),
  publishMessageEventFromLead: vi.fn(),
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
  findLeadByPhone: smsMocks.findLeadByPhone,
}))

vi.mock('../../../services/voice', () => ({
  generateTwimlVoiceResponse: voiceMocks.generateTwimlVoiceResponse,
  generateEmptyTwimlResponse: voiceMocks.generateEmptyTwimlResponse,
  generateIncomingTwiml: voiceMocks.generateIncomingTwiml,
  generateUnknownCallerGateTwiml: voiceMocks.generateUnknownCallerGateTwiml,
  generateInvalidGateTwiml: voiceMocks.generateInvalidGateTwiml,
  generateNoStaffTwiml: voiceMocks.generateNoStaffTwiml,
  generateVoicemailTwiml: voiceMocks.generateVoicemailTwiml,
  generateVoicemailCompleteTwiml: voiceMocks.generateVoicemailCompleteTwiml,
  findConversationByPhone: voiceMocks.findConversationByPhone,
  createPlaceholderConversation: voiceMocks.createPlaceholderConversation,
  recordMissedInboundCall: voiceMocks.recordMissedInboundCall,
  recordRingingInboundCall: voiceMocks.recordRingingInboundCall,
  recordVoicemailInboundCall: voiceMocks.recordVoicemailInboundCall,
  createLeadInboundCallMessage: voiceMocks.createLeadInboundCallMessage,
  updateLeadCallMessageBySid: voiceMocks.updateLeadCallMessageBySid,
  upsertLeadMissedCallMessage: voiceMocks.upsertLeadMissedCallMessage,
  formatVoicemailDuration: voiceMocks.formatVoicemailDuration,
  isValidE164Phone: voiceMocks.isValidE164Phone,
  sanitizeRecordingDuration: voiceMocks.sanitizeRecordingDuration,
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromConversation: realtimeMocks.publishMessageEventFromConversation,
  publishMessageEventFromLead: realtimeMocks.publishMessageEventFromLead,
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

async function postUnknownGate(
  input: {
    from?: string
    to?: string
    digits?: string
    calledNumber?: string
    includeCallSid?: boolean
    includeTo?: boolean
    ip?: string
  } = {}
) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
  })

  if (input.includeCallSid !== false) body.set('CallSid', 'CA_test')
  if (input.digits !== undefined) body.set('Digits', input.digits)
  if (input.includeTo !== false) body.set('To', input.to ?? '+15550000001')

  const query = input.calledNumber ? `?calledNumber=${encodeURIComponent(input.calledNumber)}` : ''

  return createApp().request(`/webhooks/twilio/voice/unknown-gate${query}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.4.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

async function postOutboundVoice(
  input: {
    to?: string
    messageId?: string
    caseId?: string
    ip?: string
  } = {}
) {
  const body = new URLSearchParams({
    From: 'client:staff_1',
    CallSid: 'CA_outbound',
  })

  if (input.to !== undefined) body.set('To', input.to)
  if (input.messageId !== undefined) body.set('messageId', input.messageId)
  if (input.caseId !== undefined) body.set('caseId', input.caseId)

  return createApp().request('/webhooks/twilio/voice', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.3.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

async function postVoicemailRecording(
  input: {
    from?: string
    to?: string
    calledNumber?: string
    includeCallSid?: boolean
    includeTo?: boolean
    ip?: string
  } = {}
) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
    RecordingSid: 'RE_test',
    RecordingUrl: 'https://recordings.example.test/RE_test',
    RecordingStatus: 'completed',
    RecordingDuration: '12',
  })

  if (input.includeCallSid !== false) body.set('CallSid', 'CA_voicemail')
  if (input.includeTo !== false) {
    body.set('To', input.to ?? '+15559990000')
  }

  const query = input.calledNumber ? `?calledNumber=${encodeURIComponent(input.calledNumber)}` : ''

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

async function postInboundRecording(
  input: {
    includeCallSid?: boolean
    ip?: string
  } = {}
) {
  const body = new URLSearchParams({
    RecordingSid: 'RE_inbound',
    RecordingUrl: 'https://recordings.example.test/RE_inbound',
    RecordingStatus: 'completed',
    RecordingDuration: '12',
  })

  if (input.includeCallSid !== false) body.set('CallSid', 'CA_inbound')

  return createApp().request('/webhooks/twilio/voice/inbound-recording', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': input.ip ?? `127.0.5.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

async function postDialComplete(
  input: {
    from?: string
    calledNumber?: string
    dialStatus?: string
    includeCallSid?: boolean
    includeTo?: boolean
    ip?: string
  } = {}
) {
  const body = new URLSearchParams({
    From: input.from ?? '+15551112222',
    DialCallStatus: input.dialStatus ?? 'no-answer',
  })

  if (input.includeCallSid !== false) body.set('CallSid', 'CA_test')
  if (input.includeTo) {
    body.set('To', input.calledNumber ?? '+15550000001')
  }

  const query = input.calledNumber ? `?calledNumber=${encodeURIComponent(input.calledNumber)}` : ''

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
    smsMocks.findLeadByPhone.mockResolvedValue(null)
    realtimeMocks.publishMessageEventFromConversation.mockResolvedValue(undefined)
    realtimeMocks.publishMessageEventFromLead.mockResolvedValue(undefined)
    voiceMocks.isValidE164Phone.mockImplementation((phone: string) =>
      /^\+[1-9]\d{9,14}$/.test(phone)
    )
    voiceMocks.generateNoStaffTwiml.mockReturnValue('<Response><Say>Voicemail</Say></Response>')
    voiceMocks.generateVoicemailTwiml.mockReturnValue('<Response><Hangup /></Response>')
    voiceMocks.generateTwimlVoiceResponse.mockReturnValue('<Response><Dial /></Response>')
    voiceMocks.generateEmptyTwimlResponse.mockReturnValue('<Response></Response>')
    voiceMocks.generateUnknownCallerGateTwiml.mockReturnValue('<Response><Gather /></Response>')
    voiceMocks.generateInvalidGateTwiml.mockReturnValue('<Response><Hangup /></Response>')
    voiceMocks.sanitizeRecordingDuration.mockReturnValue(12)
    voiceMocks.formatVoicemailDuration.mockReturnValue('0:12')
    voiceMocks.generateIncomingTwiml.mockImplementation(
      ({ staffIdentities }) => `<Response>${staffIdentities.join(',')}</Response>`
    )
    voiceMocks.createPlaceholderConversation.mockResolvedValue({ id: 'conversation_unknown' })
    voiceMocks.recordMissedInboundCall.mockResolvedValue({
      id: 'missed_message_1',
      conversationId: 'conversation_unknown',
    })
    voiceMocks.recordRingingInboundCall.mockResolvedValue({
      id: 'message_1',
      conversationId: 'conversation_unknown',
    })
    voiceMocks.recordVoicemailInboundCall.mockResolvedValue({
      id: 'message_1',
      conversationId: 'conversation_existing',
      created: true,
    })
    voiceMocks.createLeadInboundCallMessage.mockResolvedValue({
      id: 'lead_call_1',
      leadId: 'lead_1',
    })
    voiceMocks.updateLeadCallMessageBySid.mockResolvedValue(null)
    voiceMocks.upsertLeadMissedCallMessage.mockResolvedValue({
      id: 'lead_missed_call_1',
      leadId: 'lead_1',
    })
    prismaMocks.message.findFirst.mockResolvedValue(null)
    prismaMocks.message.update.mockResolvedValue({ id: 'message_1' })
    prismaMocks.$transaction.mockImplementation(async (callback) =>
      callback({
        message: {
          create: vi.fn().mockResolvedValue({ id: 'message_1' }),
          findFirst: prismaMocks.message.findFirst,
          update: prismaMocks.message.update,
        },
        conversation: {
          update: vi.fn().mockResolvedValue({ id: 'conversation_unknown' }),
        },
        $executeRaw: vi.fn().mockResolvedValue(0),
      })
    )
  })

  it('resolves outbound call destination from messageId instead of browser-visible phone', async () => {
    prismaMocks.message.findFirst.mockResolvedValueOnce({
      id: 'message_outbound',
      conversation: {
        caseId: 'case_1',
        taxCase: {
          client: { phone: '+15554443333' },
        },
      },
    })

    const res = await postOutboundVoice({
      to: '*** *** 3333',
      messageId: 'message_outbound',
      caseId: 'case_1',
    })

    expect(res.status).toBe(200)
    expect(voiceMocks.generateTwimlVoiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+15554443333',
        callerId: '+15550000000',
      })
    )
    expect(prismaMocks.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'message_outbound',
          channel: 'CALL',
          direction: 'OUTBOUND',
          conversation: { caseId: 'case_1' },
        },
      })
    )
    expect(prismaMocks.message.update).toHaveBeenCalledWith({
      where: { id: 'message_outbound' },
      data: { callSid: 'CA_outbound' },
    })
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
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phone: { in: expect.arrayContaining(['+15551112222', '5551112222']) },
          organizationId: 'org_a',
          clientType: 'INDIVIDUAL',
        },
      })
    )
    expect(prismaMocks.staffPresence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staff: expect.objectContaining({
            organizationId: 'org_a',
            OR: expect.arrayContaining([
              { role: 'ADMIN' },
              { role: 'MANAGER' },
              { managedClientLinks: { some: { clientId: 'client_a' } } },
            ]),
          }),
        }),
      })
    )
    expect(voiceMocks.recordMissedInboundCall).toHaveBeenCalledWith({
      callerPhone: '+15551112222',
      organizationId: 'org_a',
      callSid: 'CA_test',
      callStatus: 'no-answer',
    })
    expect(smsMocks.sendMissedCallTextBack).toHaveBeenCalledWith('+15551112222', 'org_a')
    expect(realtimeMocks.publishMessageEventFromConversation).toHaveBeenCalledWith(
      'conversation_unknown',
      {
        id: 'missed_message_1',
        direction: 'INBOUND',
        channel: 'CALL',
      }
    )
  })

  it('resolves legacy formatted firmPhone values for incoming calls', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_a',
      organizationId: 'org_a',
      taxCases: [],
    })
    prismaMocks.staffPresence.findMany.mockResolvedValue([])

    const res = await postIncomingCall({ from: '+15551112222', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(prismaMocks.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firmPhone: expect.objectContaining({
            in: expect.arrayContaining(['+15550000001', '(555) 000-0001']),
          }),
        }),
      })
    )
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phone: { in: expect.arrayContaining(['+15551112222', '5551112222']) },
          organizationId: 'org_a',
          clientType: 'INDIVIDUAL',
        },
      })
    )
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

  it('falls back from configured Twilio number to the only active organization', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([])
    prismaMocks.organization.findMany.mockResolvedValueOnce([])
    prismaMocks.organization.findMany.mockResolvedValueOnce([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const res = await postIncomingCall({ to: '+15550000000' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<Gather')
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          phone: { in: expect.arrayContaining(['+15551112222', '5551112222']) },
          organizationId: 'org_a',
          clientType: 'INDIVIDUAL',
        },
      })
    )
    expect(voiceMocks.generateUnknownCallerGateTwiml).toHaveBeenCalledWith({
      actionUrl: expect.stringContaining('calledNumber=%2B15550000000'),
    })
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
  })

  it('does not fall back from configured Twilio number when active organization ownership is ambiguous', async () => {
    prismaMocks.organization.findMany.mockResolvedValueOnce([])
    prismaMocks.organization.findMany.mockResolvedValueOnce([{ id: 'org_a' }, { id: 'org_b' }])

    const res = await postIncomingCall({ to: '+15550000000' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Voicemail')
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('routes ambiguous called numbers to voicemail without tenant lookups', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }, { id: 'org_b' }])

    const res = await postIncomingCall({ to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Voicemail')
    expect(prismaMocks.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('asks unknown callers to press 1 before staff lookup or placeholder creation', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue(null)

    const res = await postIncomingCall({ from: '+15553334444', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<Gather')
    expect(voiceMocks.generateUnknownCallerGateTwiml).toHaveBeenCalledWith({
      actionUrl: expect.stringContaining('calledNumber=%2B15550000001'),
    })
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(voiceMocks.recordMissedInboundCall).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('hangs up unknown gate callbacks when the caller does not press 1', async () => {
    const res = await postUnknownGate({
      digits: '2',
      includeTo: false,
      calledNumber: '+15550000001',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<Hangup')
    expect(voiceMocks.generateInvalidGateTwiml).toHaveBeenCalled()
    expect(prismaMocks.organization.findMany).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(voiceMocks.recordMissedInboundCall).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
  })

  it('does not persist approved unknown gate callbacks with invalid caller data', async () => {
    const res = await postUnknownGate({
      from: 'anonymous',
      digits: '1',
      includeTo: false,
      calledNumber: '+15550000001',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<Hangup')
    expect(voiceMocks.generateInvalidGateTwiml).toHaveBeenCalled()
    expect(prismaMocks.organization.findMany).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(voiceMocks.recordMissedInboundCall).not.toHaveBeenCalled()
  })

  it('routes approved unknown callers to online admin, manager, and staff in the resolved organization', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.staffPresence.findMany.mockResolvedValue([
      { deviceId: 'staff_admin_device', staff: { id: 'staff_admin', role: 'ADMIN' } },
      { deviceId: 'staff_manager_device', staff: { id: 'staff_manager', role: 'MANAGER' } },
      { deviceId: 'staff_member_device', staff: { id: 'staff_member', role: 'STAFF' } },
    ])

    const res = await postUnknownGate({
      from: '+15553334444',
      calledNumber: '+15550000001',
      includeTo: false,
      digits: '1',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('staff_admin_device')
    expect(voiceMocks.generateIncomingTwiml).toHaveBeenCalledWith(
      expect.objectContaining({
        staffIdentities: ['staff_admin_device', 'staff_manager_device', 'staff_member_device'],
      })
    )
    expect(prismaMocks.staffPresence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lastSeen: {
            gte: expect.any(Date),
          },
          staff: expect.objectContaining({
            organizationId: 'org_a',
            OR: [{ role: 'ADMIN' }, { role: 'MANAGER' }, { role: 'STAFF' }],
          }),
        }),
      })
    )
    const presenceQuery = prismaMocks.staffPresence.findMany.mock.calls[0][0]
    expect(Date.now() - presenceQuery.where.lastSeen.gte.getTime()).toBeLessThanOrEqual(
      2 * 60 * 1000 + 1000
    )
    expect(voiceMocks.recordRingingInboundCall).toHaveBeenCalledWith({
      callerPhone: '+15553334444',
      organizationId: 'org_a',
      callSid: 'CA_test',
    })
    const incomingOptions = voiceMocks.generateIncomingTwiml.mock.calls[0][0]
    expect(new URL(incomingOptions.dialCompleteUrl).searchParams.get('calledNumber')).toBe(
      '+15550000001'
    )
    expect(new URL(incomingOptions.recordingStatusCallback).searchParams.get('calledNumber')).toBe(
      '+15550000001'
    )
  })

  it('routes known lead callers without the gate and creates a lead-owned call message', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue(null)
    smsMocks.findLeadByPhone.mockResolvedValue({
      id: 'lead_1',
      organizationId: 'org_a',
      status: 'NEW',
    })
    prismaMocks.staffPresence.findMany.mockResolvedValue([
      { deviceId: 'staff_admin_device', staff: { id: 'staff_admin', role: 'ADMIN' } },
    ])

    const res = await postIncomingCall({ from: '+15553334444', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('staff_admin_device')
    expect(voiceMocks.generateUnknownCallerGateTwiml).not.toHaveBeenCalled()
    expect(prismaMocks.staffPresence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staff: expect.objectContaining({
            organizationId: 'org_a',
            OR: [{ role: 'ADMIN' }, { role: 'MANAGER' }],
          }),
        }),
      })
    )
    expect(voiceMocks.createLeadInboundCallMessage).toHaveBeenCalledWith({
      leadId: 'lead_1',
      callerPhone: '+15553334444',
      callSid: 'CA_test',
      callStatus: 'ringing',
    })
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
    expect(realtimeMocks.publishMessageEventFromLead).toHaveBeenCalledWith('lead_1', {
      id: 'lead_call_1',
      direction: 'INBOUND',
      channel: 'CALL',
    })
  })

  it('keeps client routing precedence when a phone also matches a lead', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_a',
      organizationId: 'org_a',
      taxCases: [],
    })
    smsMocks.findLeadByPhone.mockResolvedValue({
      id: 'lead_1',
      organizationId: 'org_a',
      status: 'NEW',
    })
    prismaMocks.staffPresence.findMany.mockResolvedValue([])

    const res = await postIncomingCall({ from: '+15553334444', to: '+15550000001' })

    expect(res.status).toBe(200)
    expect(voiceMocks.upsertLeadMissedCallMessage).not.toHaveBeenCalled()
    expect(voiceMocks.createLeadInboundCallMessage).not.toHaveBeenCalled()
    expect(voiceMocks.recordMissedInboundCall).toHaveBeenCalledWith({
      callerPhone: '+15553334444',
      organizationId: 'org_a',
      callSid: 'CA_test',
      callStatus: 'no-answer',
    })
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
    expect(voiceMocks.recordMissedInboundCall).toHaveBeenCalledWith({
      callerPhone: '+15551112222',
      organizationId: 'org_a',
      callSid: 'CA_test',
      callStatus: 'no-answer',
      content: 'Call - No answer',
    })
    expect(realtimeMocks.publishMessageEventFromConversation).toHaveBeenCalledWith(
      'conversation_unknown',
      {
        id: 'missed_message_1',
        direction: 'INBOUND',
        channel: 'CALL',
      }
    )
    expect(voiceMocks.generateVoicemailTwiml).toHaveBeenCalledWith({
      voicemailCallbackUrl: expect.stringContaining('calledNumber=%2B15550000001'),
      voicemailCompleteUrl: expect.stringContaining('calledNumber=%2B15550000001'),
    })
  })

  it('updates lead-owned call messages on dial-complete without missed-call textback', async () => {
    voiceMocks.updateLeadCallMessageBySid.mockResolvedValue({ id: 'lead_call_1', leadId: 'lead_1' })

    const res = await postDialComplete({
      from: '+15551112222',
      calledNumber: '+15550000001',
      includeTo: false,
      dialStatus: 'no-answer',
    })

    expect(res.status).toBe(200)
    expect(voiceMocks.updateLeadCallMessageBySid).toHaveBeenCalledWith({
      callSid: 'CA_test',
      callStatus: 'no-answer',
      content: 'Call - No answer',
    })
    expect(voiceMocks.recordMissedInboundCall).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
    expect(realtimeMocks.publishMessageEventFromLead).toHaveBeenCalledWith('lead_1', {
      id: 'lead_call_1',
      direction: 'INBOUND',
      channel: 'CALL',
    })
  })

  it('does not update messages when dial-complete is missing CallSid', async () => {
    const res = await postDialComplete({
      includeCallSid: false,
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(voiceMocks.updateLeadCallMessageBySid).not.toHaveBeenCalled()
    expect(voiceMocks.recordMissedInboundCall).not.toHaveBeenCalled()
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
    expect(smsMocks.sendMissedCallTextBack).not.toHaveBeenCalled()
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
    expect(voiceMocks.recordVoicemailInboundCall).not.toHaveBeenCalled()
  })

  it('does not update inbound recordings when CallSid is missing', async () => {
    const res = await postInboundRecording({ includeCallSid: false })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      received: true,
      processed: false,
      warning: 'INVALID_CALL_SID',
    })
    expect(prismaMocks.message.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.message.update).not.toHaveBeenCalled()
  })

  it('updates lead-owned inbound call recordings by CallSid', async () => {
    prismaMocks.message.findFirst.mockResolvedValue({
      id: 'lead_call_1',
      leadId: 'lead_1',
    })
    prismaMocks.message.update.mockResolvedValue({
      id: 'lead_call_1',
      leadId: 'lead_1',
    })

    const res = await postInboundRecording()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, processed: true })
    expect(prismaMocks.message.findFirst).toHaveBeenCalledWith({
      where: { callSid: 'CA_inbound' },
    })
    expect(realtimeMocks.publishMessageEventFromLead).toHaveBeenCalledWith('lead_1', {
      id: 'lead_call_1',
      direction: 'INBOUND',
      channel: 'CALL',
    })
  })

  it('does not persist voicemail recordings when CallSid is missing', async () => {
    const res = await postVoicemailRecording({
      includeCallSid: false,
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      received: true,
      processed: false,
      warning: 'INVALID_CALL_SID',
    })
    expect(prismaMocks.organization.findMany).not.toHaveBeenCalled()
    expect(prismaMocks.message.findFirst).not.toHaveBeenCalled()
    expect(voiceMocks.createPlaceholderConversation).not.toHaveBeenCalled()
  })

  it('uses calledNumber query context for voicemail callback persistence', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])

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
    expect(voiceMocks.recordVoicemailInboundCall).toHaveBeenCalledWith({
      callerPhone: '+15554445555',
      organizationId: 'org_a',
      callSid: 'CA_voicemail',
      recordingUrl: 'https://recordings.example.test/RE_test',
      recordingDuration: 12,
    })
  })

  it('updates existing lead-owned voicemail recordings without creating a placeholder', async () => {
    prismaMocks.organization.findMany.mockResolvedValue([{ id: 'org_a' }])
    voiceMocks.updateLeadCallMessageBySid.mockResolvedValue({ id: 'lead_call_1', leadId: 'lead_1' })

    const res = await postVoicemailRecording({
      from: '+15554445555',
      calledNumber: '+15550000001',
      includeTo: false,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, processed: true })
    expect(voiceMocks.recordVoicemailInboundCall).not.toHaveBeenCalled()
    expect(realtimeMocks.publishMessageEventFromLead).toHaveBeenCalledWith('lead_1', {
      id: 'lead_call_1',
      direction: 'INBOUND',
      channel: 'CALL',
    })
  })
})
