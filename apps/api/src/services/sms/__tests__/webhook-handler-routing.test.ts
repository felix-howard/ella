/**
 * Webhook Handler Routing Tests (Phase 03)
 * Focus: inbound SMS routing priority and collision handling.
 * Covers matrix rows:
 *   #2  lead-only match → processLeadInbound invoked
 *   #3  phone collision (client case + lead) → client wins, collision logged
 *   #10 duplicate twilioSid → idempotent (returns DUPLICATE_MESSAGE)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    message: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    action: {
      create: vi.fn().mockResolvedValue({ id: 'action_1' }),
    },
  },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: { authToken: null },
    nodeEnv: 'test',
  },
}))

vi.mock('../../../lib/client-helpers', () => ({
  isBizWithGroup: vi.fn().mockReturnValue(false),
}))

vi.mock('../mms-media-handler', () => ({
  processMmsMedia: vi.fn().mockResolvedValue({
    attachmentUrls: [],
    attachmentR2Keys: [],
    rawImageIds: [],
  }),
}))

vi.mock('../../activity-tracker', () => ({
  updateLastActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../realtime/message-publisher', () => ({
  publishMessageEventFromConversation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../voice/voicemail-helpers', () => ({
  isValidE164Phone: vi.fn().mockReturnValue(true),
  createPlaceholderConversation: vi.fn(),
  findDefaultOrganizationId: vi.fn().mockResolvedValue('org_default'),
  sanitizePhone: (s: string) => s,
}))

vi.mock('../lead-inbound-handler', () => ({
  findLeadByPhone: vi.fn(),
  processLeadInbound: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { findLeadByPhone, processLeadInbound } from '../lead-inbound-handler'
import { processIncomingMessage, type TwilioIncomingMessage } from '../webhook-handler'
import type { Lead } from '@ella/db'

function makeIncoming(overrides: Partial<TwilioIncomingMessage> = {}): TwilioIncomingMessage {
  return {
    MessageSid: 'SM_unique_1',
    AccountSid: 'AC_test',
    From: '+15551234567',
    To: '+15550001111',
    Body: 'hi',
    NumMedia: '0',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processIncomingMessage — routing priority (Phase 03)', () => {
  it('row #10: duplicate twilioSid returns DUPLICATE_MESSAGE (idempotent)', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({ id: 'existing' } as never)

    const res = await processIncomingMessage(makeIncoming({ MessageSid: 'SM_dup' }))
    expect(res.success).toBe(false)
    expect(res.error).toBe('DUPLICATE_MESSAGE')
    // Should NOT have attempted lead or client lookup
    expect(vi.mocked(findLeadByPhone)).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.client.findFirst)).not.toHaveBeenCalled()
  })

  it('row #2: lead match with no client case → routes to processLeadInbound', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(null)
    const matchedLead = { id: 'lead_1', phone: '+15551234567' } as unknown as Lead
    vi.mocked(findLeadByPhone).mockResolvedValueOnce(matchedLead)
    vi.mocked(processLeadInbound).mockResolvedValueOnce({
      success: true,
      messageId: 'lead_msg_1',
      leadId: 'lead_1',
    })

    const res = await processIncomingMessage(makeIncoming({ MessageSid: 'SM_lead', Body: 'lead inbound' }))
    expect(res.success).toBe(true)
    expect(res.leadId).toBe('lead_1')
    expect(vi.mocked(processLeadInbound)).toHaveBeenCalledWith(
      matchedLead,
      'lead inbound',
      'SM_lead',
      0
    )
    // Client-case conversation path NOT taken
    expect(vi.mocked(prisma.conversation.upsert)).not.toHaveBeenCalled()
  })

  it('row #3: phone collision (client case + lead) → client wins, collision logged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    const client = {
      id: 'client_1',
      phone: '+15551234567',
      taxCases: [{ id: 'case_1' }],
    }
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(client as never)
    vi.mocked(findLeadByPhone).mockResolvedValueOnce({ id: 'lead_1' } as unknown as Lead)
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_1' } as never)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg_client_1' } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({} as never)

    const res = await processIncomingMessage(makeIncoming({ MessageSid: 'SM_collision' }))
    expect(res.success).toBe(true)
    expect(res.caseId).toBe('case_1') // client case wins
    expect(res.leadId).toBeUndefined()

    // Collision warning was emitted
    const collisionCall = warnSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('InboundCollision')
    )
    expect(collisionCall).toBeTruthy()
    // Lead branch NOT invoked
    expect(vi.mocked(processLeadInbound)).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
