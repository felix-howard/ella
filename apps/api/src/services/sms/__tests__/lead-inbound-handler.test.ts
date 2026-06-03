/**
 * Lead Inbound Handler Tests (Phase 03)
 * Covers findLeadByPhone phone-format tolerance, CONVERTED exclusion,
 * and processLeadInbound persistence + realtime publish + MMS drop (v1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../realtime/message-publisher', () => ({
  publishMessageEventFromLead: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '../../../lib/db'
import { publishMessageEventFromLead } from '../../realtime/message-publisher'
import { findLeadByPhone, processLeadInbound } from '../lead-inbound-handler'
import type { Lead } from '@ella/db'

beforeEach(() => {
  vi.clearAllMocks()
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
  const baseLead = { id: 'lead_1', phone: '+15551234567' } as unknown as Lead

  it('creates Message(leadId, INBOUND, SMS) with twilioSid', async () => {
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg_1' } as never)
    const res = await processLeadInbound(baseLead, 'hello', 'SM123', 0)
    expect(res.success).toBe(true)
    expect(res.messageId).toBe('msg_1')
    expect(vi.mocked(prisma.message.create)).toHaveBeenCalledWith({
      data: {
        leadId: 'lead_1',
        channel: 'SMS',
        direction: 'INBOUND',
        content: 'hello',
        twilioSid: 'SM123',
      },
    })
  })

  it('publishes realtime event (non-blocking)', async () => {
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg_2' } as never)
    await processLeadInbound(baseLead, 'hello', 'SM456', 0)
    expect(vi.mocked(publishMessageEventFromLead)).toHaveBeenCalledWith('lead_1', {
      id: 'msg_2',
      direction: 'INBOUND',
      channel: 'SMS',
    })
  })

  it('drops MMS attachments (v1 limitation) — logs warning but succeeds', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg_3' } as never)
    const res = await processLeadInbound(baseLead, 'hi', 'SM789', 2)
    expect(res.success).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
    const warning = warnSpy.mock.calls[0][0] as string
    expect(warning).toContain('MMS')
    expect(warning).toContain('not supported')
    warnSpy.mockRestore()
  })
})
