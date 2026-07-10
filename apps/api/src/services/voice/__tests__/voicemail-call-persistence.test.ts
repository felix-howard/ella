import { beforeEach, describe, expect, it, vi } from 'vitest'

const txMocks = vi.hoisted(() => ({
  message: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversation: {
    update: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  $executeRaw: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

import {
  recordMissedInboundCall,
  recordRingingInboundCall,
  recordVoicemailInboundCall,
} from '../voicemail-helpers'

describe('conversation-owned voice call persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txMocks.$executeRaw.mockResolvedValue(0)
    txMocks.message.update.mockResolvedValue({ id: 'message_1' })
    txMocks.conversation.update.mockResolvedValue({ id: 'conversation_1' })
    prismaMocks.$transaction.mockImplementation(async (callback) => callback(txMocks))
  })

  it('locks by CallSid before updating an existing missed call', async () => {
    txMocks.message.findFirst.mockResolvedValue({
      id: 'message_1',
      callStatus: 'ringing',
      conversationId: 'conversation_1',
    })

    const result = await recordMissedInboundCall({
      callerPhone: '+15551112222',
      organizationId: 'org_1',
      callSid: 'CA_existing',
      callStatus: 'no-answer',
    })

    expect(result).toEqual({ id: 'message_1', conversationId: 'conversation_1' })
    expect(txMocks.$executeRaw).toHaveBeenCalled()
    expect(txMocks.message.create).not.toHaveBeenCalled()
  })

  it('locks by CallSid before returning an existing ringing call', async () => {
    txMocks.message.findFirst.mockResolvedValue({
      id: 'message_1',
      conversationId: 'conversation_1',
    })

    const result = await recordRingingInboundCall({
      callerPhone: '+15551112222',
      organizationId: 'org_1',
      callSid: 'CA_existing',
    })

    expect(result).toEqual({ id: 'message_1', conversationId: 'conversation_1' })
    expect(txMocks.$executeRaw).toHaveBeenCalled()
    expect(txMocks.message.create).not.toHaveBeenCalled()
  })

  it('locks by CallSid before updating an existing voicemail callback', async () => {
    txMocks.message.findFirst.mockResolvedValue({
      id: 'message_1',
      callStatus: 'ringing',
      conversationId: 'conversation_1',
    })

    const result = await recordVoicemailInboundCall({
      callerPhone: '+15551112222',
      organizationId: 'org_1',
      callSid: 'CA_existing',
      recordingUrl: 'https://recordings.example.test/RE_test',
      recordingDuration: 12,
    })

    expect(result).toEqual({ id: 'message_1', conversationId: 'conversation_1', created: false })
    expect(txMocks.$executeRaw).toHaveBeenCalled()
    expect(txMocks.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'message_1' },
      })
    )
    expect(txMocks.message.create).not.toHaveBeenCalled()
  })

  it('does not increment unread count again for duplicate voicemail callbacks', async () => {
    txMocks.message.findFirst.mockResolvedValue({
      id: 'message_1',
      callStatus: 'voicemail',
      conversationId: 'conversation_1',
    })

    const result = await recordVoicemailInboundCall({
      callerPhone: '+15551112222',
      organizationId: 'org_1',
      callSid: 'CA_existing',
      recordingUrl: 'https://recordings.example.test/RE_test',
      recordingDuration: 12,
    })

    expect(result).toEqual({ id: 'message_1', conversationId: 'conversation_1', created: false })
    expect(txMocks.$executeRaw).toHaveBeenCalled()
    expect(txMocks.conversation.update.mock.calls[0][0].data).not.toHaveProperty('unreadCount')
  })
})
