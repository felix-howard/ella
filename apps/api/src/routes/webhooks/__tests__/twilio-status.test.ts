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
  recordMissedInboundCall: vi.fn(),
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
  publishMessageEventFromLead: vi.fn(() => Promise.resolve()),
}))

import {
  publishMessageEventFromConversation,
  publishMessageEventFromLead,
} from '../../../services/realtime/message-publisher'
import { twilioWebhookRoute } from '../twilio'

function createApp() {
  const app = new Hono()
  app.route('/webhooks/twilio', twilioWebhookRoute)
  return app
}

const TERMINAL_CALL_STATUSES = ['completed', 'busy', 'no-answer', 'failed', 'canceled'] as const

function expectTerminalCallStatusUpdate(callStatus: string, content?: string) {
  expect(prismaMocks.message.updateMany).toHaveBeenCalledWith({
    where: {
      id: 'message_outbound',
      OR: [
        { callStatus: null },
        {
          callStatus: {
            notIn: TERMINAL_CALL_STATUSES,
          },
        },
      ],
    },
    data: {
      callStatus,
      ...(content ? { content } : {}),
    },
  })
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

async function postVoiceStatus(
  fields: Record<string, string>,
  options: { messageId?: string; signature?: string } = {}
) {
  const body = new URLSearchParams({
    CallSid: 'CA_child_1',
    CallStatus: 'completed',
    ...fields,
  })
  const query = options.messageId
    ? `?messageId=${encodeURIComponent(options.messageId)}`
    : ''

  return createApp().request(`/webhooks/twilio/voice/status${query}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': options.signature ?? 'valid',
      'x-forwarded-host': 'api.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': `127.0.4.${Math.floor(Math.random() * 200) + 1}`,
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
      leadId: null,
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
      leadId: null,
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

  it('uses Twilio error-code descriptions when callback omits a useful error message', async () => {
    const res = await postStatus({
      MessageStatus: 'failed',
      ErrorCode: '30008',
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: true,
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: {
        twilioStatus: expect.stringContaining('failed:30008:Twilio or the carrier returned a generic delivery failure'),
      },
    })
    expect(prismaMocks.smsSendLog.updateMany).toHaveBeenCalledWith({
      where: { twilioSid: 'SM_status_1' },
      data: {
        status: 'UNDELIVERED',
        error: expect.stringContaining('30008: Twilio or the carrier returned a generic delivery failure'),
      },
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

  it('publishes lead-owned message status updates to lead realtime listeners', async () => {
    prismaMocks.message.findFirst.mockResolvedValueOnce({
      id: 'msg_lead_1',
      conversationId: null,
      leadId: 'lead_1',
      direction: 'OUTBOUND',
      channel: 'SMS',
    })

    const res = await postStatus({ MessageStatus: 'delivered' })

    expect(res.status).toBe(200)
    await vi.waitFor(() => {
      expect(publishMessageEventFromLead).toHaveBeenCalledWith('lead_1', {
        id: 'msg_lead_1',
        direction: 'OUTBOUND',
        channel: 'SMS',
        eventType: 'message.status.updated',
        twilioStatus: 'delivered',
        twilioErrorCode: null,
      })
    })
    expect(publishMessageEventFromConversation).not.toHaveBeenCalled()
  })
})

describe('Twilio voice status webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smsMocks.validateTwilioSignature.mockReturnValue({ valid: true })
    prismaMocks.message.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.message.findFirst.mockResolvedValue({
      id: 'message_outbound',
      callStatus: null,
    })
  })

  it.each([
    ['completed', undefined],
    ['busy', 'Call - Busy'],
    ['no-answer', 'Call - No answer'],
    ['failed', 'Call - Failed'],
    ['canceled', 'Call - Canceled'],
  ])('persists terminal child status %s by scoped message id', async (callStatus, content) => {
    const res = await postVoiceStatus(
      { CallStatus: callStatus, CallSid: 'CA_child_terminal' },
      { messageId: 'message_outbound' }
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: true,
      count: 1,
    })
    expectTerminalCallStatusUpdate(callStatus, content)
  })

  it('validates the exact callback URL including message correlation query', async () => {
    await postVoiceStatus({}, { messageId: 'message with spaces' })

    expect(smsMocks.validateTwilioSignature).toHaveBeenCalledWith(
      'https://api.example.test/webhooks/twilio/voice/status?messageId=message%20with%20spaces',
      expect.objectContaining({
        CallSid: 'CA_child_1',
        CallStatus: 'completed',
      }),
      'valid'
    )
  })

  it('rejects invalid signatures before database access', async () => {
    smsMocks.validateTwilioSignature.mockReturnValueOnce({
      valid: false,
      error: 'invalid signature',
    })

    const res = await postVoiceStatus({}, { messageId: 'message_outbound', signature: 'invalid' })

    expect(res.status).toBe(403)
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.message.findFirst).not.toHaveBeenCalled()
  })

  it('does not overwrite the first persisted terminal outcome', async () => {
    prismaMocks.message.findFirst.mockResolvedValueOnce({
      id: 'message_outbound',
      callStatus: 'completed',
    })

    const res = await postVoiceStatus(
      { CallStatus: 'no-answer' },
      { messageId: 'message_outbound' }
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: false,
      ignored: 'TERMINAL_STATUS_ALREADY_RECORDED',
    })
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
  })

  it('treats a concurrent terminal update loser as an idempotent delivery', async () => {
    prismaMocks.message.findFirst
      .mockResolvedValueOnce({ id: 'message_outbound', callStatus: null })
      .mockResolvedValueOnce({ id: 'message_outbound', callStatus: 'busy' })
    prismaMocks.message.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await postVoiceStatus(
      { CallStatus: 'completed' },
      { messageId: 'message_outbound' }
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: false,
      ignored: 'TERMINAL_STATUS_ALREADY_RECORDED',
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMocks.message.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 'message_outbound' },
      select: { callStatus: true },
    })
  })

  it('reports an uncorrelated child callback without writing another message', async () => {
    prismaMocks.message.findFirst.mockResolvedValueOnce(null)

    const res = await postVoiceStatus({}, { messageId: 'unknown_message' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: false,
      warning: 'MESSAGE_NOT_FOUND',
    })
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a terminal callback without message or legacy SID correlation', async () => {
    const res = await postVoiceStatus({ CallSid: '' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      received: true,
      processed: false,
      warning: 'MISSING_CORRELATION',
    })
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
    expect(prismaMocks.message.findFirst).not.toHaveBeenCalled()
  })

  it('retains parent CallSid fallback for legacy callbacks without messageId', async () => {
    const res = await postVoiceStatus({ CallSid: 'CA_parent_legacy', CallStatus: 'busy' })

    expect(res.status).toBe(200)
    expect(prismaMocks.message.findFirst).toHaveBeenCalledWith({
      where: {
        callSid: 'CA_parent_legacy',
        channel: 'CALL',
        direction: 'OUTBOUND',
      },
      select: { id: true, callStatus: true },
    })
    expectTerminalCallStatusUpdate('busy', 'Call - Busy')
  })

  it('falls back from a missing query id to the provider parent CallSid', async () => {
    const res = await postVoiceStatus({
      CallSid: 'CA_child_1',
      ParentCallSid: 'CA_parent_outbound',
      CallStatus: 'failed',
    })

    expect(res.status).toBe(200)
    expect(prismaMocks.message.findFirst).toHaveBeenCalledWith({
      where: {
        callSid: 'CA_parent_outbound',
        channel: 'CALL',
        direction: 'OUTBOUND',
      },
      select: { id: true, callStatus: true },
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'message_outbound' }),
        data: {
          callStatus: 'failed',
          content: 'Call - Failed',
        },
      })
    )
  })

  it('falls back from an unknown query id to the provider parent CallSid', async () => {
    prismaMocks.message.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'message_outbound', callStatus: null })

    const res = await postVoiceStatus(
      {
        CallSid: 'CA_child_1',
        ParentCallSid: 'CA_parent_outbound',
        CallStatus: 'no-answer',
      },
      { messageId: 'unknown_message' }
    )

    expect(res.status).toBe(200)
    expect(prismaMocks.message.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        callSid: 'CA_parent_outbound',
        channel: 'CALL',
        direction: 'OUTBOUND',
      },
      select: { id: true, callStatus: true },
    })
    expect(prismaMocks.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'message_outbound' }),
      })
    )
  })

  it('ignores non-terminal progress events without writing', async () => {
    const res = await postVoiceStatus(
      { CallStatus: 'ringing' },
      { messageId: 'message_outbound' }
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })
    expect(prismaMocks.message.updateMany).not.toHaveBeenCalled()
  })
})
