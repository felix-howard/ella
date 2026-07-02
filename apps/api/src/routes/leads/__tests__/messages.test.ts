/**
 * Lead Messages API Integration Tests
 * Covers GET/POST endpoints on /leads/:id/messages(/send|/unread|/read).
 * - Org-scoped lookup → cross-org returns 404 (security row 9)
 * - Outbound POST dual-writes Message + SmsSendLog (matrix row 1)
 * - Unread count respects messagesLastReadAt watermark
 * - Mark-read clamps upTo to min(upTo, now()) to prevent silent-read race
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    message: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    action: {
      updateMany: vi.fn(),
    },
    smsSendLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../../../services/sms', () => ({
  sendSmsOnly: vi.fn(),
  isSmsEnabled: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromLead: vi.fn().mockResolvedValue(undefined),
  publishLeadReadEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../services/storage', () => ({
  resolveAvatarUrl: vi.fn(async (avatarUrl: string | null | undefined) =>
    avatarUrl ? `signed:${avatarUrl}` : null
  ),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.example/signed'),
  getSafeStorageReference: (key: string) => ({ objectType: key.split('/')[0], keyHash: 'hash' }),
  getSafeStorageError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({ route: '/leads/:id/messages/read', method: 'POST' })),
  logStaffActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    if (!c.get('user')) {
      c.set('user', {
        id: 'clerk-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
        role: 'ORG_ADMIN',
        orgRole: 'org:admin',
        email: 't@t.com',
        name: 'Tester',
        clerkOrgId: 'clerk_org_1',
      })
    }
    await next()
  }
  const requireOrgAdmin = async (_c: any, next: () => Promise<void>) => next()
  return { authMiddleware, requireOrgAdmin, requireAdminOrManager: requireOrgAdmin }
})

import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'
import { prisma } from '../../../lib/db'
import { sendSmsOnly } from '../../../services/sms'
import { logStaffActivity } from '../../../services/activity-log'
import { getSignedDownloadUrl, resolveAvatarUrl } from '../../../services/storage'
import { publishLeadReadEvent } from '../../../services/realtime/message-publisher'
import { leadMessagesRoute } from '../messages'

const VALID_LEAD_CUID = 'cmnldqbqa0005gf6cuecae3x1'
const OTHER_ORG_LEAD_CUID = 'cmnildqbqa0005gf6cuecae3x2'
const NOW = new Date('2026-04-24T10:00:00Z')
const QUOTE_LINK_CONTENT =
  'Quote $7,000: https://my.ella.tax/quote/lead_quote Pay: https://my.ella.tax/pay/lead_pay'
const AGREEMENT_LINK_CONTENT = 'Please sign: https://my.ella.tax/agreements/lead_agreement'
const ORDINARY_OUTBOUND_CONTENT = 'Thanks for reaching out. We will follow up shortly.'
const ORDINARY_INBOUND_CONTENT = 'Sounds good, thank you.'

function buildApp(userOverride?: Record<string, unknown>) {
  const app = new Hono<{ Variables: AuthVariables }>()
  if (userOverride) {
    app.use('*', async (c, next) => {
      c.set('user', {
        id: 'clerk-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
        role: 'ORG_ADMIN',
        orgRole: 'org:admin',
        email: 't@t.com',
        name: 'Tester',
        clerkOrgId: 'clerk_org_1',
        ...userOverride,
      } as never)
      await next()
    })
  }
  app.route('/leads', leadMessagesRoute)
  return app
}

function leadMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    leadId: VALID_LEAD_CUID,
    direction: 'OUTBOUND',
    channel: 'SMS',
    content: ORDINARY_OUTBOUND_CONTENT,
    templateUsed: null,
    staffAuthoredContent: null,
    twilioStatus: 'sent',
    attachmentUrls: [],
    attachmentR2Keys: [],
    createdAt: NOW,
    updatedAt: NOW,
    sentBy: null,
    ...overrides,
  }
}

function mockLeadMessages(messages: Array<Record<string, unknown>>) {
  vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
  vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never)
  vi.mocked(prisma.message.count).mockResolvedValueOnce(messages.length)
}

function expectNoSensitiveLeadLeak(payload: unknown) {
  const rawBody = JSON.stringify(payload)
  expect(rawBody).not.toContain('/quote/')
  expect(rawBody).not.toContain('/pay/')
  expect(rawBody).not.toContain('/agreements/')
  expect(rawBody).not.toContain('$7,000')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.$queryRaw).mockReset()
  vi.mocked(prisma.smsSendLog.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.action.updateMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(prisma.lead.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never)
})

describe('GET /leads/messages/conversations', () => {
  function getRawQueryText(callIndex: number): string {
    return vi.mocked(prisma.$queryRaw).mock.calls[callIndex]
      .map((part) => {
        if (Array.isArray(part)) return part.join('')
        if (part && typeof part === 'object' && 'strings' in part) {
          return Array.from((part as { strings: string[] }).strings).join('')
        }
        return String(part)
      })
      .join('')
  }

  function mockConversationQueries(input: {
    backfillRows?: Array<{
      leadId: string
      message: string
      status: string
      twilioSid: string | null
      error: string | null
      sentById: string
      sentAt: Date
    }>
    rows?: Array<{ leadId: string; lastMessageAt: Date }>
    total?: bigint
    unreadRows?: Array<{ leadId: string; unreadCount: bigint }>
    totalUnread?: bigint
  } = {}) {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce((input.backfillRows ?? []) as never)
      .mockResolvedValueOnce((input.rows ?? [{ leadId: VALID_LEAD_CUID, lastMessageAt: NOW }]) as never)
      .mockResolvedValueOnce([{ total: input.total ?? 1n }] as never)
      .mockResolvedValueOnce((input.unreadRows ?? [{ leadId: VALID_LEAD_CUID, unreadCount: 2n }]) as never)
      .mockResolvedValueOnce([{ totalUnread: input.totalUnread ?? 3n }] as never)
  }

  function mockConversationLead(messageOverrides: Record<string, unknown> = {}) {
    vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([
      {
        id: VALID_LEAD_CUID,
        firstName: 'Andy',
        lastName: 'Nguyen',
        phone: '+15551234567',
        status: 'NEW',
        campaignTag: 'tax-fair',
        tags: ['tax-fair'],
        messages: [leadMessage(messageOverrides)],
      },
    ] as never)
  }

  it('returns org-scoped active lead conversations with unread totals and CALL fields', async () => {
    mockConversationQueries()
    mockConversationLead({
      id: 'm_call',
      channel: 'CALL',
      direction: 'INBOUND',
      content: 'Incoming call',
      callSid: 'CA123',
      recordingUrl: 'https://api.twilio.com/recordings/RE123.mp3',
      recordingDuration: 42,
      callStatus: 'completed',
    })

    const res = await buildApp().request('/leads/messages/conversations?page=1&limit=10&unreadOnly=true')

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      conversations: Array<{
        unreadCount: number
        lead: { id: string; name: string; phone: string; campaignTag: string | null; tags: string[] }
        lastMessage: {
          channel: string
          callSid?: string
          recordingUrl?: string
          recordingDuration?: number
          callStatus?: string
          attachmentR2Keys?: string[]
        } | null
      }>
      totalUnread: number
      pagination: { total: number; page: number; limit: number; totalPages: number }
    }

    expect(body.totalUnread).toBe(3)
    expect(body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 })
    expect(body.conversations[0]?.unreadCount).toBe(2)
    expect(body.conversations[0]?.lead).toMatchObject({
      id: VALID_LEAD_CUID,
      name: 'Andy Nguyen',
      phone: '+15551234567',
      campaignTag: 'tax-fair',
      tags: ['tax-fair'],
    })
    expect(body.conversations[0]?.lastMessage).toMatchObject({
      channel: 'CALL',
      callSid: 'CA123',
      recordingUrl: 'https://api.twilio.com/recordings/RE123.mp3',
      recordingDuration: 42,
      callStatus: 'completed',
    })
    expect(body.conversations[0]?.lastMessage).not.toHaveProperty('attachmentR2Keys')
    expect(vi.mocked(prisma.lead.findMany)).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: [VALID_LEAD_CUID] },
        organizationId: 'org_1',
        status: { not: 'CONVERTED' },
      },
    }))
    const pageQuery = getRawQueryText(1)
    const countQuery = getRawQueryText(2)
    for (const sql of [pageQuery, countQuery]) {
      expect(sql).toContain('INNER JOIN "Message" m ON m."leadId" = l.id')
      expect(sql).toContain('WHERE l."organizationId" =')
      expect(sql).toContain("AND l.status != 'CONVERTED'")
      expect(sql).toContain('HAVING COUNT(m.id) FILTER')
    }
    expect(pageQuery).toContain('ORDER BY MAX(m."createdAt") DESC, l.id ASC')
    expect(pageQuery).toContain('OFFSET')
    expect(pageQuery).toContain('LIMIT')
  })

  it('redacts manager last-message content and returns only lead media proxy URLs', async () => {
    mockConversationQueries()
    mockConversationLead({
      id: 'm_quote',
      content: QUOTE_LINK_CONTENT,
      templateUsed: 'quote_pay_link',
      staffAuthoredContent: 'Please review the $7,000 quote and pay link.',
      attachmentUrls: ['https://r2.example/signed'],
      attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM123/0.jpg'],
    })

    const res = await buildApp({ role: 'MANAGER', orgRole: 'org:member' })
      .request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      conversations: Array<{
        lastMessage: {
          content: string
          staffAuthoredContent?: string | null
          attachmentUrls?: string[]
          attachmentR2Keys?: string[]
        } | null
      }>
    }

    expect(body.conversations[0]?.lastMessage?.content).toBe('A payment link was sent to the client.')
    expect(body.conversations[0]?.lastMessage?.staffAuthoredContent).toBeNull()
    expect(body.conversations[0]?.lastMessage?.attachmentUrls).toEqual([
      `/leads/${VALID_LEAD_CUID}/messages/media/m_quote/0`,
    ])
    expect(body.conversations[0]?.lastMessage).not.toHaveProperty('attachmentR2Keys')
    expectNoSensitiveLeadLeak(body)
  })

  it('normalizes lead call preview content so managers never receive raw caller phones', async () => {
    mockConversationQueries()
    mockConversationLead({
      id: 'm_call_phone',
      channel: 'CALL',
      direction: 'INBOUND',
      content: 'Incoming call from +15551112222',
      callStatus: 'ringing',
    })

    const res = await buildApp({ role: 'MANAGER', orgRole: 'org:member' })
      .request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      conversations: Array<{ lastMessage: { content: string } | null }>
    }
    expect(body.conversations[0]?.lastMessage?.content).toBe('Incoming call')
    expect(JSON.stringify(body)).not.toContain('+15551112222')
  })

  it('returns an empty page without loading lead rows when no conversations match', async () => {
    mockConversationQueries({
      rows: [],
      total: 0n,
      unreadRows: [],
      totalUnread: 0n,
    })

    const res = await buildApp().request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      conversations: unknown[]
      totalUnread: number
      pagination: { total: number }
    }
    expect(body.conversations).toEqual([])
    expect(body.totalUnread).toBe(0)
    expect(body.pagination.total).toBe(0)
    expect(vi.mocked(prisma.lead.findMany)).not.toHaveBeenCalled()
  })

  it('backfills active-org legacy SmsSendLog rows before listing conversations', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    const legacyBackfillRow = {
      leadId: VALID_LEAD_CUID,
      message: 'legacy bulk sms',
      status: 'SENT',
      twilioSid: 'SM_LEGACY',
      error: null,
      sentById: 'staff_1',
      sentAt,
    }
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([legacyBackfillRow] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, lastMessageAt: sentAt }] as never)
      .mockResolvedValueOnce([{ total: 1n }] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, unreadCount: 0n }] as never)
      .mockResolvedValueOnce([{ totalUnread: 0n }] as never)
    mockConversationLead({ id: 'm_legacy', content: 'legacy bulk sms', createdAt: sentAt, updatedAt: sentAt })

    const res = await buildApp().request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    const backfillQuery = getRawQueryText(0)
    expect(backfillQuery).toContain('FROM "SmsSendLog" s')
    expect(backfillQuery).toContain('INNER JOIN "Lead" l ON l.id = s."leadId"')
    expect(backfillQuery).toContain('LEFT JOIN "Message" existing ON existing."twilioSid" = s."twilioSid"')
    expect(backfillQuery).toContain('WHERE s."organizationId" =')
    expect(backfillQuery).toContain("AND l.status != 'CONVERTED'")
    expect(backfillQuery).toContain('AND existing.id IS NULL')
    expect(backfillQuery).toContain('LIMIT')
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy bulk sms',
        twilioSid: 'SM_LEGACY',
        twilioStatus: 'sent',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
  })

  it('preserves undelivered legacy SmsSendLog status during conversation backfill', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{
        leadId: VALID_LEAD_CUID,
        message: 'legacy failed sms',
        status: 'UNDELIVERED',
        twilioSid: 'SM_UNDELIVERED',
        error: 'Carrier rejected message',
        sentById: 'staff_1',
        sentAt,
      }] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, lastMessageAt: sentAt }] as never)
      .mockResolvedValueOnce([{ total: 1n }] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, unreadCount: 0n }] as never)
      .mockResolvedValueOnce([{ totalUnread: 0n }] as never)
    mockConversationLead({ id: 'm_legacy', content: 'legacy failed sms', twilioStatus: 'undelivered' })

    const res = await buildApp().request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy failed sms',
        twilioSid: 'SM_UNDELIVERED',
        twilioStatus: 'undelivered',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
  })

  it('sanitizes failed legacy SmsSendLog errors during conversation backfill', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{
        leadId: VALID_LEAD_CUID,
        message: 'legacy failed sms',
        status: 'FAILED',
        twilioSid: 'SM_FAILED',
        error: 'TWILIO_ERROR_21211: Invalid To +15551112222',
        sentById: 'staff_1',
        sentAt,
      }] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, lastMessageAt: sentAt }] as never)
      .mockResolvedValueOnce([{ total: 1n }] as never)
      .mockResolvedValueOnce([{ leadId: VALID_LEAD_CUID, unreadCount: 0n }] as never)
      .mockResolvedValueOnce([{ totalUnread: 0n }] as never)
    mockConversationLead({ id: 'm_legacy', content: 'legacy failed sms', twilioStatus: 'ERROR: SMS provider error 21211' })

    const res = await buildApp().request('/leads/messages/conversations')

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy failed sms',
        twilioSid: 'SM_FAILED',
        twilioStatus: 'ERROR: SMS provider error 21211',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
    expect(JSON.stringify(vi.mocked(prisma.message.createMany).mock.calls[0][0])).not.toContain('+15551112222')
  })
})

describe('GET /leads/:id/messages', () => {
  it('redacts manager automated payment and agreement lead messages', async () => {
    mockLeadMessages([
      leadMessage({
        id: 'm_quote',
        content: QUOTE_LINK_CONTENT,
        templateUsed: 'quote_pay_link',
        staffAuthoredContent: 'Please review the $7,000 quote and pay link.',
      }),
      leadMessage({
        id: 'm_agreement',
        content: AGREEMENT_LINK_CONTENT,
        templateUsed: 'agreement_invite',
      }),
      leadMessage({
        id: 'm_pay_url',
        content: 'Pay here: https://my.ella.tax/pay/lead_pay_fallback',
        templateUsed: null,
      }),
    ])

    const res = await buildApp({ role: 'MANAGER', orgRole: 'org:member' })
      .request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      messages: Array<{ content: string; staffAuthoredContent?: string | null; twilioStatus?: string }>
    }
    expect(body.messages.map((message) => message.content)).toEqual([
      'A payment link was sent to the client.',
      'An agreement link was sent to the client.',
      'A payment link was sent to the client.',
    ])
    expect(body.messages[0]?.staffAuthoredContent).toBeNull()
    expect(body.messages[0]?.twilioStatus).toBe('sent')
    expectNoSensitiveLeadLeak(body)
  })

  it('keeps admin automated lead message content unchanged', async () => {
    mockLeadMessages([
      leadMessage({
        id: 'm_quote',
        content: QUOTE_LINK_CONTENT,
        templateUsed: 'quote_pay_link',
        staffAuthoredContent: 'Please review the $7,000 quote and pay link.',
      }),
      leadMessage({
        id: 'm_agreement',
        content: AGREEMENT_LINK_CONTENT,
        templateUsed: 'agreement_invite',
      }),
    ])

    const res = await buildApp({ role: 'ADMIN', orgRole: 'org:admin' })
      .request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      messages: Array<{ content: string; staffAuthoredContent?: string | null }>
    }
    expect(body.messages[0]?.content).toBe(QUOTE_LINK_CONTENT)
    expect(body.messages[0]?.staffAuthoredContent).toBe('Please review the $7,000 quote and pay link.')
    expect(body.messages[1]?.content).toBe(AGREEMENT_LINK_CONTENT)
  })

  it('does not redact ordinary lead outbound or inbound messages for managers', async () => {
    mockLeadMessages([
      leadMessage({ id: 'm_outbound', content: ORDINARY_OUTBOUND_CONTENT }),
      leadMessage({
        id: 'm_inbound',
        direction: 'INBOUND',
        content: ORDINARY_INBOUND_CONTENT,
      }),
    ])

    const res = await buildApp({ role: 'MANAGER', orgRole: 'org:member' })
      .request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { messages: Array<{ content: string }> }
    expect(body.messages.map((message) => message.content)).toEqual([
      ORDINARY_OUTBOUND_CONTENT,
      ORDINARY_INBOUND_CONTENT,
    ])
  })

  it('normalizes lead call detail content so managers never receive raw caller phones', async () => {
    mockLeadMessages([
      leadMessage({
        id: 'm_call_phone',
        direction: 'INBOUND',
        channel: 'CALL',
        content: 'Incoming call from +15551112222',
        callStatus: 'no-answer',
      }),
    ])

    const res = await buildApp({ role: 'MANAGER', orgRole: 'org:member' })
      .request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { messages: Array<{ content: string }> }
    expect(body.messages[0]?.content).toBe('Missed call')
    expect(JSON.stringify(body)).not.toContain('+15551112222')
  })

  it('returns paginated messages for an org-owned lead', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'm1',
        leadId: VALID_LEAD_CUID,
        direction: 'OUTBOUND',
        channel: 'SMS',
        content: 'hello',
        createdAt: new Date('2026-04-24T10:00:00Z'),
        updatedAt: new Date('2026-04-24T10:00:00Z'),
        sentBy: null,
      },
    ] as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { messages: unknown[]; pagination: { total: number } }
    expect(body.messages).toHaveLength(1)
    expect(body.pagination.total).toBe(1)

    // Verify org-scoped lookup
    expect(vi.mocked(prisma.lead.findFirst)).toHaveBeenCalledWith({
      where: { id: VALID_LEAD_CUID, organizationId: 'org_1' },
      select: { id: true },
    })
  })

  it('returns the latest message window in chronological display order', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      leadMessage({
        id: 'm51',
        content: 'newest',
        createdAt: new Date('2026-04-24T10:51:00Z'),
        updatedAt: new Date('2026-04-24T10:51:00Z'),
      }),
      leadMessage({
        id: 'm50',
        content: 'older',
        createdAt: new Date('2026-04-24T10:50:00Z'),
        updatedAt: new Date('2026-04-24T10:50:00Z'),
      }),
    ] as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(51)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages?latest=true&limit=50`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      messages: Array<{ id: string }>
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(body.messages.map((message) => message.id)).toEqual(['m50', 'm51'])
    expect(body.pagination).toEqual({ page: 2, limit: 50, total: 51, totalPages: 2 })
    expect(vi.mocked(prisma.message.findMany)).toHaveBeenCalledWith(expect.objectContaining({
      where: { leadId: VALID_LEAD_CUID },
      take: 50,
      orderBy: { createdAt: 'desc' },
    }))
    expect(vi.mocked(prisma.message.findMany).mock.calls[0][0]).not.toHaveProperty('skip')
  })

  it('resolves staff avatar R2 keys before returning lead chat messages', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'm1',
        leadId: VALID_LEAD_CUID,
        direction: 'OUTBOUND',
        channel: 'SMS',
        content: 'hello',
        createdAt: new Date('2026-04-24T10:00:00Z'),
        updatedAt: new Date('2026-04-24T10:00:00Z'),
        sentBy: { id: 'staff_1', name: 'Tester', avatarUrl: 'avatars/staff_1/photo.jpg' },
      },
    ] as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      messages: Array<{ sentBy: { avatarUrl: string | null } | null }>
    }
    expect(body.messages[0]?.sentBy?.avatarUrl).toBe('signed:avatars/staff_1/photo.jpg')
    expect(vi.mocked(resolveAvatarUrl)).toHaveBeenCalledWith('avatars/staff_1/photo.jpg')
  })

  it('returns lead MMS attachments as proxy URLs and hides R2 keys', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'm_mms',
        leadId: VALID_LEAD_CUID,
        direction: 'INBOUND',
        channel: 'SMS',
        content: '',
        attachmentUrls: ['https://r2.example/signed'],
        attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM123/0.jpg'],
        createdAt: new Date('2026-04-24T10:00:00Z'),
        updatedAt: new Date('2026-04-24T10:00:00Z'),
        sentBy: null,
      },
    ] as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      messages: Array<{ attachmentUrls: string[]; attachmentR2Keys?: string[] }>
    }
    expect(body.messages[0]?.attachmentUrls).toEqual([
      `/leads/${VALID_LEAD_CUID}/messages/media/m_mms/0`,
    ])
    expect(body.messages[0]).not.toHaveProperty('attachmentR2Keys')
  })

  it('backfills legacy SmsSendLog rows so prior bulk SMS appears in lead chat', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.smsSendLog.findMany).mockResolvedValueOnce([
      {
        leadId: VALID_LEAD_CUID,
        message: 'legacy bulk sms',
        status: 'SENT',
        twilioSid: 'SM_LEGACY',
        error: null,
        sentById: 'staff_1',
        sentAt,
      },
    ] as never)
    vi.mocked(prisma.message.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        {
          id: 'm_legacy',
          leadId: VALID_LEAD_CUID,
          direction: 'OUTBOUND',
          channel: 'SMS',
          content: 'legacy bulk sms',
          twilioSid: 'SM_LEGACY',
          createdAt: sentAt,
          updatedAt: sentAt,
          sentBy: null,
        },
      ] as never)
    vi.mocked(prisma.message.createMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { messages: Array<{ content: string }> }
    expect(body.messages[0]?.content).toBe('legacy bulk sms')
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy bulk sms',
        twilioSid: 'SM_LEGACY',
        twilioStatus: 'sent',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
  })

  it('preserves undelivered legacy SmsSendLog status during detail backfill', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.smsSendLog.findMany).mockResolvedValueOnce([
      {
        leadId: VALID_LEAD_CUID,
        message: 'legacy failed sms',
        status: 'UNDELIVERED',
        twilioSid: 'SM_UNDELIVERED',
        error: 'Carrier rejected message',
        sentById: 'staff_1',
        sentAt,
      },
    ] as never)
    vi.mocked(prisma.message.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        leadMessage({
          id: 'm_undelivered',
          content: 'legacy failed sms',
          twilioSid: 'SM_UNDELIVERED',
          twilioStatus: 'undelivered',
          createdAt: sentAt,
          updatedAt: sentAt,
        }),
      ] as never)
    vi.mocked(prisma.message.createMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy failed sms',
        twilioSid: 'SM_UNDELIVERED',
        twilioStatus: 'undelivered',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
  })

  it('sanitizes failed legacy SmsSendLog errors during detail backfill', async () => {
    const sentAt = new Date('2026-04-24T09:55:00Z')
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: VALID_LEAD_CUID } as never)
    vi.mocked(prisma.smsSendLog.findMany).mockResolvedValueOnce([
      {
        leadId: VALID_LEAD_CUID,
        message: 'legacy failed sms',
        status: 'FAILED',
        twilioSid: 'SM_FAILED',
        error: 'TWILIO_ERROR_21211: Invalid To +15551112222',
        sentById: 'staff_1',
        sentAt,
      },
    ] as never)
    vi.mocked(prisma.message.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        leadMessage({
          id: 'm_failed',
          content: 'legacy failed sms',
          twilioSid: 'SM_FAILED',
          twilioStatus: 'ERROR: SMS provider error 21211',
          createdAt: sentAt,
          updatedAt: sentAt,
        }),
      ] as never)
    vi.mocked(prisma.message.createMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(1)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages`)

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.message.createMany)).toHaveBeenCalledWith({
      data: [{
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'legacy failed sms',
        twilioSid: 'SM_FAILED',
        twilioStatus: 'ERROR: SMS provider error 21211',
        sentById: 'staff_1',
        createdAt: sentAt,
      }],
      skipDuplicates: true,
    })
    expect(JSON.stringify(vi.mocked(prisma.message.createMany).mock.calls[0][0])).not.toContain('+15551112222')
  })

  it('cross-org access returns 404 (not 403) — matrix row 9', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    const res = await buildApp().request(`/leads/${OTHER_ORG_LEAD_CUID}/messages`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('NOT_FOUND')
  })
})

describe('GET /leads/:id/messages/media/:messageId/:index', () => {
  it('proxies an org-scoped lead message attachment with private no-store headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from('image'), {
      headers: { 'content-type': 'image/jpeg' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      attachmentUrls: ['https://r2.example/signed'],
      attachmentR2Keys: ['lead-message-attachments/org_1/lead_1/SM123/0.jpg'],
    } as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/media/m_mms/0`)

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(res.headers.get('content-type')).toContain('image/jpeg')
    expect(vi.mocked(prisma.message.findFirst)).toHaveBeenCalledWith({
      where: {
        id: 'm_mms',
        leadId: VALID_LEAD_CUID,
        lead: { organizationId: 'org_1' },
      },
      select: {
        attachmentR2Keys: true,
        attachmentUrls: true,
      },
    })
    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      'lead-message-attachments/org_1/lead_1/SM123/0.jpg',
      900
    )
    expect(fetchMock).toHaveBeenCalledWith('https://r2.example/signed')
    vi.unstubAllGlobals()
  })

  it('returns 404 for cross-org or missing lead message media', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/media/m_mms/0`)

    expect(res.status).toBe(404)
    expect(getSignedDownloadUrl).not.toHaveBeenCalled()
  })
})

describe('POST /leads/:id/messages/send', () => {
  it('dual-writes Message + SmsSendLog and returns created message', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      phone: '+15551234567',
    } as never)
    vi.mocked(sendSmsOnly).mockResolvedValueOnce({ success: true, sid: 'SM123', status: 'queued' } as never)

    const createdMessage = {
      id: 'm_new',
      leadId: VALID_LEAD_CUID,
      channel: 'SMS',
      direction: 'OUTBOUND',
      content: 'hi',
      twilioSid: 'SM123',
      twilioStatus: 'queued',
      sentById: 'staff_1',
      createdAt: new Date('2026-04-24T10:01:00Z'),
      updatedAt: new Date('2026-04-24T10:01:00Z'),
      sentBy: null,
    }
    // $transaction receives an array of PrismaPromise; return the resolved tuple
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([createdMessage, { id: 'log_1' }] as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hi', channel: 'SMS' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { sent: boolean; message: { id: string } }
    expect(body.sent).toBe(true)
    expect(body.message.id).toBe('m_new')
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendSmsOnly)).toHaveBeenCalledWith('+15551234567', 'hi')

    // Pin the dual-write payload — both creates are constructed eagerly when
    // building the $transaction array, so a regression that drops the SmsSendLog
    // call (or changes its data shape) fails here, not silently in production.
    expect(vi.mocked(prisma.message.create)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prisma.message.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        leadId: VALID_LEAD_CUID,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'hi',
        twilioSid: 'SM123',
        twilioStatus: 'queued',
        sentById: 'staff_1',
      }),
    })
    expect(vi.mocked(prisma.smsSendLog.create)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prisma.smsSendLog.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        leadId: VALID_LEAD_CUID,
        message: 'hi',
        status: 'SENT',
        twilioSid: 'SM123',
        sentById: 'staff_1',
        organizationId: 'org_1',
      }),
    })
  })

  it('persists Message with safe ERROR status when Twilio send fails (no rollback — staff-visible failure)', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      phone: '+15551234567',
    } as never)
    vi.mocked(sendSmsOnly).mockResolvedValueOnce({
      success: false,
      error: 'TWILIO_ERROR_21211: Invalid To +15551234567',
    } as never)
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([
      {
        id: 'm_failed',
        leadId: VALID_LEAD_CUID,
        twilioStatus: 'ERROR: SMS provider error 21211',
        twilioSid: null,
        createdAt: new Date('2026-04-24T10:02:00Z'),
        updatedAt: new Date('2026-04-24T10:02:00Z'),
      },
      { id: 'log_failed' },
    ] as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'oops', channel: 'SMS' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { sent: boolean; error?: string }
    expect(body.sent).toBe(false)
    expect(body.error).toBe('SMS provider error 21211')
    expect(JSON.stringify(body)).not.toContain('+15551234567')
    // Message row STILL created — staff sees the failed attempt in the thread.
    expect(vi.mocked(prisma.message.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        twilioStatus: 'ERROR: SMS provider error 21211',
        twilioSid: null,
      }),
    })
    expect(vi.mocked(prisma.smsSendLog.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'SMS provider error 21211',
      }),
    })
    expect(JSON.stringify(vi.mocked(prisma.message.create).mock.calls[0][0])).not.toContain('+15551234567')
    expect(JSON.stringify(vi.mocked(prisma.smsSendLog.create).mock.calls[0][0])).not.toContain('+15551234567')
  })

  it('cross-org send returns 404', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hi', channel: 'SMS' }),
    })
    expect(res.status).toBe(404)
    expect(vi.mocked(sendSmsOnly)).not.toHaveBeenCalled()
  })
})

describe('GET /leads/:id/messages/unread', () => {
  it('counts INBOUND messages after messagesLastReadAt', async () => {
    const lastRead = new Date('2026-04-24T09:00:00Z')
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      messagesLastReadAt: lastRead,
    } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(2)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/unread`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { unreadCount: number }
    expect(body.unreadCount).toBe(2)
    expect(vi.mocked(prisma.message.count)).toHaveBeenCalledWith({
      where: {
        leadId: VALID_LEAD_CUID,
        direction: 'INBOUND',
        createdAt: { gt: lastRead },
      },
    })
  })

  it('returns all inbound when no lastReadAt set', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      messagesLastReadAt: null,
    } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(5)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/unread`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { unreadCount: number }
    expect(body.unreadCount).toBe(5)
    // Without lastRead, there should be no createdAt filter
    const callArgs = vi.mocked(prisma.message.count).mock.calls[0][0]
    expect(callArgs?.where).not.toHaveProperty('createdAt')
  })
})

describe('POST /leads/:id/messages/read', () => {
  it('clamps upTo to now() when upTo is in the future (prevents silent-read race)', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      messagesLastReadAt: null,
    } as never)
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)

    const futureIso = new Date(Date.now() + 60_000).toISOString()
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: futureIso }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { readAt: string }
    // readAt must be <= now (clamped, not echoed-future)
    expect(new Date(body.readAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000)
    expect(new Date(body.readAt).getTime()).toBeLessThan(new Date(futureIso).getTime())
    expect(vi.mocked(logStaffActivity)).toHaveBeenCalledWith(expect.objectContaining({
      action: 'lead.message_read',
      metadata: expect.objectContaining({ markedMessageCount: 1 }),
    }))
    expect(vi.mocked(publishLeadReadEvent)).toHaveBeenCalledWith(VALID_LEAD_CUID, {
      unreadCount: 0,
      readAt: body.readAt,
    })
  })

  it('accepts past upTo as-is', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      messagesLastReadAt: null,
    } as never)
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)

    const pastIso = '2026-04-24T08:00:00Z'
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: pastIso }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { readAt: string }
    expect(body.readAt).toBe(new Date(pastIso).toISOString())
    expect(vi.mocked(publishLeadReadEvent)).toHaveBeenCalledWith(VALID_LEAD_CUID, {
      unreadCount: 0,
      readAt: new Date(pastIso).toISOString(),
    })
  })

  it('returns 404 when lead not in org', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(404)
    expect(vi.mocked(prisma.lead.updateMany)).not.toHaveBeenCalled()
    expect(vi.mocked(logStaffActivity)).not.toHaveBeenCalled()
  })

  it('does not update or log activity when the read watermark is already current', async () => {
    const readAt = new Date('2026-04-24T08:00:00Z')
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      messagesLastReadAt: readAt,
    } as never)
    vi.mocked(prisma.message.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: readAt.toISOString() }),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.lead.updateMany)).not.toHaveBeenCalled()
    expect(vi.mocked(logStaffActivity)).not.toHaveBeenCalled()
    expect(vi.mocked(publishLeadReadEvent)).not.toHaveBeenCalled()
  })

  it('uses the stored newer read watermark for stale read requests before completing actions', async () => {
    const storedReadAt = new Date('2026-04-24T10:00:00Z')
    const staleReadAt = new Date('2026-04-24T08:00:00Z')
    vi.mocked(prisma.lead.findFirst)
      .mockResolvedValueOnce({
        id: VALID_LEAD_CUID,
        messagesLastReadAt: storedReadAt,
      } as never)
      .mockResolvedValueOnce({
        messagesLastReadAt: storedReadAt,
      } as never)
    vi.mocked(prisma.message.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    vi.mocked(prisma.action.updateMany).mockResolvedValueOnce({ count: 1 } as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: staleReadAt.toISOString() }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { readAt: string; unreadCount: number }
    expect(body.readAt).toBe(storedReadAt.toISOString())
    expect(body.unreadCount).toBe(0)
    expect(vi.mocked(prisma.lead.updateMany)).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.message.count).mock.calls[1][0]).toEqual({
      where: {
        leadId: VALID_LEAD_CUID,
        direction: 'INBOUND',
        createdAt: { gt: storedReadAt },
      },
    })
    expect(vi.mocked(prisma.action.updateMany)).toHaveBeenCalledWith({
      where: {
        leadId: VALID_LEAD_CUID,
        type: 'LEAD_REPLIED',
        isCompleted: false,
      },
      data: {
        isCompleted: true,
        completedAt: storedReadAt,
      },
    })
  })
})
