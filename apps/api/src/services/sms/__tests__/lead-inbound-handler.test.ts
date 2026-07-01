/**
 * Lead Inbound Handler Tests (Phase 03)
 * Covers findLeadByPhone phone-format tolerance, CONVERTED exclusion,
 * and processLeadInbound persistence + realtime publish + lead reply fanout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    taxCase: {
      findFirst: vi.fn(),
    },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      count: vi.fn(),
    },
    action: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('../../realtime/message-publisher', () => ({
  publishMessageEventFromConversation: vi.fn().mockResolvedValue(undefined),
  publishMessageEventFromLead: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../web-push', () => ({
  notifyClientMessagePushFromConversation: vi.fn().mockResolvedValue(null),
  notifyLeadMessagePushFromLead: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../activity-log', () => ({
  logSystemActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lead-mms-media-handler', () => ({
  processLeadMmsMedia: vi.fn().mockResolvedValue({
    attachmentUrls: [],
    attachmentR2Keys: [],
    errors: [],
  }),
}))

import { prisma } from '../../../lib/db'
import {
  publishMessageEventFromConversation,
  publishMessageEventFromLead,
} from '../../realtime/message-publisher'
import {
  notifyClientMessagePushFromConversation,
  notifyLeadMessagePushFromLead,
} from '../../web-push'
import { logSystemActivity } from '../../activity-log'
import { processLeadMmsMedia } from '../lead-mms-media-handler'
import { findLeadByPhone, processLeadInbound } from '../lead-inbound-handler'
import type { Lead } from '@ella/db'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$transaction).mockImplementation((callback) => callback(prisma) as never)
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({
    status: 'NEW',
    convertedToId: null,
  } as never)
  vi.mocked(prisma.taxCase.findFirst).mockResolvedValue({ id: 'case_1' } as never)
  vi.mocked(prisma.conversation.upsert).mockResolvedValue({ id: 'conv_1' } as never)
  vi.mocked(prisma.conversation.update).mockResolvedValue({ id: 'conv_1' } as never)
  vi.mocked(prisma.message.count).mockResolvedValue(1)
  vi.mocked(prisma.action.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.action.create).mockResolvedValue({ id: 'action_1' } as never)
  vi.mocked(prisma.action.update).mockResolvedValue({ id: 'action_1' } as never)
  vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never)
  vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(processLeadMmsMedia).mockResolvedValue({
    attachmentUrls: [],
    attachmentR2Keys: [],
    errors: [],
  })
})

describe('findLeadByPhone', () => {
  it('tries raw, E.164, and digits-only phone formats', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    await findLeadByPhone('+15551234567')
    expect(vi.mocked(prisma.lead.findFirst)).toHaveBeenCalledWith({
      where: {
        status: { not: 'CONVERTED' },
        OR: [
          { phone: '+15551234567' },
          { phone: '+15551234567' },
          { phone: '5551234567' },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    })
  })

  it('excludes CONVERTED leads', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    await findLeadByPhone('5551234567')
    const where = vi.mocked(prisma.lead.findFirst).mock.calls[0][0]?.where as {
      status: { not: string }
    }
    expect(where.status).toEqual({ not: 'CONVERTED' })
  })

  it('scopes lookup to organization when provided', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    await findLeadByPhone('+15551234567', 'org_1')
    expect(vi.mocked(prisma.lead.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
        }),
      })
    )
  })

  it('returns the matched lead (most-recently-updated first)', async () => {
    const lead = { id: 'lead_1', phone: '+15551234567', status: 'NEW' } as unknown as Lead
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(lead)
    const result = await findLeadByPhone('+15551234567')
    expect(result).toBe(lead)
  })
})

describe('processLeadInbound', () => {
  const baseLead = {
    id: 'lead_1',
    phone: '+15551234567',
    status: 'NEW',
    organizationId: 'org_1',
    messagesLastReadAt: null,
  } as unknown as Lead

  const incoming = {
    MessageSid: 'SM123',
    AccountSid: 'AC_test',
    From: '+15551234567',
    To: '+15550001111',
    Body: 'hello',
    NumMedia: '0',
  }

  it('creates Message(leadId, INBOUND, SMS) with twilioSid', async () => {
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg_1',
      createdAt: new Date('2026-04-24T10:00:00Z'),
      direction: 'INBOUND',
      channel: 'SMS',
    } as never)
    const res = await processLeadInbound(baseLead, incoming, 'hello')
    expect(res.success).toBe(true)
    expect(res.messageId).toBe('msg_1')
    expect(vi.mocked(prisma.message.create)).toHaveBeenCalledWith({
      data: {
        leadId: 'lead_1',
        channel: 'SMS',
        direction: 'INBOUND',
        content: 'hello',
        twilioSid: 'SM123',
        attachmentUrls: [],
        attachmentR2Keys: [],
      },
    })
    expect(vi.mocked(prisma.lead.updateMany)).toHaveBeenCalledWith({
      where: { id: 'lead_1', status: { in: ['NEW', 'SENT'] } },
      data: { status: 'CONTACTED' },
    })
    expect(vi.mocked(prisma.action.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead_1',
        type: 'LEAD_REPLIED',
        priority: 'HIGH',
        metadata: expect.objectContaining({
          leadId: 'lead_1',
          messageId: 'msg_1',
          unreadCount: 1,
          mediaCount: 0,
        }),
      }),
    })
    const actionData = vi.mocked(prisma.action.create).mock.calls[0][0].data as {
      metadata: Record<string, unknown>
    }
    expect(actionData.metadata).not.toHaveProperty('preview')
    expect(vi.mocked(prisma.$executeRaw)).toHaveBeenCalled()
    expect(vi.mocked(prisma.$executeRaw).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.action.findFirst).mock.invocationCallOrder[0]
    )
  })

  it('publishes realtime event (non-blocking)', async () => {
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg_2',
      createdAt: new Date('2026-04-24T10:00:00Z'),
      direction: 'INBOUND',
      channel: 'SMS',
    } as never)
    await processLeadInbound(baseLead, { ...incoming, MessageSid: 'SM456' }, 'hello')
    expect(vi.mocked(publishMessageEventFromLead)).toHaveBeenCalledWith('lead_1', {
      id: 'msg_2',
      direction: 'INBOUND',
      channel: 'SMS',
    })
    expect(vi.mocked(notifyLeadMessagePushFromLead)).toHaveBeenCalledWith(
      'lead_1',
      expect.objectContaining({ id: 'msg_2', direction: 'INBOUND', channel: 'SMS' })
    )
    expect(vi.mocked(logSystemActivity)).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      action: 'lead.message_received',
      metadata: expect.objectContaining({ leadId: 'lead_1', messageId: 'msg_2' }),
    }))
  })

  it('persists MMS attachment URLs and keys returned by the lead media helper', async () => {
    vi.mocked(processLeadMmsMedia).mockResolvedValueOnce({
      attachmentUrls: ['https://r2.example/signed'],
      attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM789/0.jpg'],
      errors: [],
    })
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg_3',
      createdAt: new Date('2026-04-24T10:00:00Z'),
      direction: 'INBOUND',
      channel: 'SMS',
    } as never)
    const res = await processLeadInbound(
      baseLead,
      { ...incoming, MessageSid: 'SM789', NumMedia: '1', MediaUrl0: 'https://api.twilio.com/media/1' },
      ''
    )
    expect(res.success).toBe(true)
    expect(vi.mocked(processLeadMmsMedia)).toHaveBeenCalledWith(
      expect.objectContaining({ MessageSid: 'SM789', NumMedia: '1' }),
      baseLead
    )
    expect(vi.mocked(prisma.message.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: '',
        attachmentUrls: ['https://r2.example/signed'],
        attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM789/0.jpg'],
      }),
    })
    expect(vi.mocked(prisma.action.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          hasAttachment: true,
          mediaCount: 1,
        }),
      }),
    })
  })

  it('updates an existing incomplete LEAD_REPLIED action instead of creating another', async () => {
    vi.mocked(prisma.action.findFirst).mockResolvedValueOnce({ id: 'action_existing' } as never)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg_4',
      createdAt: new Date('2026-04-24T10:00:00Z'),
      direction: 'INBOUND',
      channel: 'SMS',
    } as never)

    await processLeadInbound(baseLead, { ...incoming, MessageSid: 'SM999' }, 'new reply')

    expect(vi.mocked(prisma.action.update)).toHaveBeenCalledWith({
      where: { id: 'action_existing' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({ messageId: 'msg_4' }),
      }),
    })
    const updateData = vi.mocked(prisma.action.update).mock.calls[0][0].data as {
      metadata: Record<string, unknown>
    }
    expect(updateData.metadata).not.toHaveProperty('preview')
    expect(vi.mocked(prisma.action.create)).not.toHaveBeenCalled()
  })

  it('reroutes to the converted client conversation after acquiring the lead lock', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
      status: 'CONVERTED',
      convertedToId: 'client_1',
    } as never)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg_client_1',
      createdAt: new Date('2026-04-24T10:00:00Z'),
      direction: 'INBOUND',
      channel: 'SMS',
      isSystem: false,
    } as never)

    const res = await processLeadInbound(baseLead, { ...incoming, MessageSid: 'SM_converted' }, 'after convert')

    expect(res).toMatchObject({
      success: true,
      messageId: 'msg_client_1',
      caseId: 'case_1',
      actionCreated: true,
    })
    expect(res.leadId).toBeUndefined()
    expect(vi.mocked(prisma.message.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_1',
        content: 'after convert',
        twilioSid: 'SM_converted',
      }),
    })
    expect(vi.mocked(prisma.action.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'case_1',
        type: 'CLIENT_REPLIED',
        metadata: expect.objectContaining({
          messageId: 'msg_client_1',
          convertedLeadId: 'lead_1',
        }),
      }),
    })
    expect(vi.mocked(prisma.lead.updateMany)).not.toHaveBeenCalled()
    expect(vi.mocked(publishMessageEventFromConversation)).toHaveBeenCalledWith('conv_1', {
      id: 'msg_client_1',
      direction: 'INBOUND',
      channel: 'SMS',
    })
    expect(vi.mocked(notifyClientMessagePushFromConversation)).toHaveBeenCalledWith(
      'conv_1',
      expect.objectContaining({ id: 'msg_client_1', direction: 'INBOUND', channel: 'SMS' })
    )
    expect(vi.mocked(publishMessageEventFromLead)).not.toHaveBeenCalled()
    expect(vi.mocked(notifyLeadMessagePushFromLead)).not.toHaveBeenCalled()
  })
})
