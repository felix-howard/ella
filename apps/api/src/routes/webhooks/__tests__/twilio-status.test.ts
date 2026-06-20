import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  message: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  smsSendLog: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lead: {
    updateMany: vi.fn(),
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

vi.mock('../../../services/voice', () => voiceMocks)

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromConversation: vi.fn(() => Promise.resolve()),
}))

import { publishMessageEventFromConversation } from '../../../services/realtime/message-publisher'
import { twilioWebhookRoute } from '../twilio'

function createApp() {
  const app = new Hono()
  app.route('/webhooks/twilio', twilioWebhookRoute)
  return app
}

async function postStatus(fields: Record<string, string>) {
  const body = new URLSearchParams({
    MessageSid: 'SM_status_1',
    MessageStatus: 'delivered',
    ...fields,
  })

  return createApp().request('/webhooks/twilio/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': `127.0.3.${Math.floor(Math.random() * 200) + 1}`,
    },
    body,
  })
}

describe('Twilio SMS status webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smsMocks.validateTwilioSignature.mockReturnValue({ valid: true })
    prismaMocks.message.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.message.findFirst.mockResolvedValue({
      id: 'msg_1',
      conversationId: 'conv_1',
      direction: 'OUTBOUND',
      channel: 'SMS',
    })
    prismaMocks.smsSendLog.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.smsSendLog.findFirst.mockResolvedValue({ leadId: 'lead_1' })
    prismaMocks.lead.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.$transaction.mockImplementation((callback) => callback(prismaMocks))
  })

  it('marks matching lead as CONTACTED when Twilio confirms delivery', async () => {
    const res = await postStatus({ MessageStatus: 'delivered' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: true,
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: { twilioStatus: 'delivered' },
    })
    await vi.waitFor(() => {
      expect(publishMessageEventFromConversation).toHaveBeenCalledWith('conv_1', {
        id: 'msg_1',
        direction: 'OUTBOUND',
        channel: 'SMS',
        eventType: 'message.status.updated',
        twilioStatus: 'delivered',
        twilioErrorCode: null,
      })
    })
    expect(prismaMocks.smsSendLog.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: { status: 'DELIVERED', error: undefined },
    })
    expect(prismaMocks.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead_1', status: { in: ['NEW', 'SENT'] } },
      data: { status: 'CONTACTED' },
    })
  })

  it('persists failed delivery details without promoting lead lifecycle status', async () => {
    prismaMocks.message.findFirst.mockResolvedValueOnce({
      id: 'msg_1',
      conversationId: 'conv_1',
      direction: 'OUTBOUND',
      channel: 'SMS',
    })

    const res = await postStatus({
      MessageStatus: 'failed',
      ErrorCode: '30007',
      ErrorMessage: 'Carrier violation',
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: true,
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: { twilioStatus: 'failed:30007:Carrier violation' },
    })
    expect(prismaMocks.smsSendLog.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: { status: 'UNDELIVERED', error: '30007: Carrier violation' },
    })
    expect(prismaMocks.smsSendLog.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.lead.updateMany).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(publishMessageEventFromConversation).toHaveBeenCalledWith('conv_1', {
        id: 'msg_1',
        direction: 'OUTBOUND',
        channel: 'SMS',
        eventType: 'message.status.updated',
        twilioStatus: 'failed:30007:Carrier violation',
        twilioErrorCode: '30007',
      })
    })
  })

  it('does not fail the webhook when realtime status lookup fails', async () => {
    prismaMocks.message.findFirst.mockRejectedValueOnce(new Error('realtime lookup failed'))

    const res = await postStatus({ MessageStatus: 'delivered' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: true,
    })
    expect(publishMessageEventFromConversation).not.toHaveBeenCalled()
  })
})
