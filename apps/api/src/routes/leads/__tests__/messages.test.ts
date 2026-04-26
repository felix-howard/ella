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
      updateMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    smsSendLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../../../services/sms', () => ({
  sendSmsOnly: vi.fn(),
  isSmsEnabled: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromLead: vi.fn().mockResolvedValue(undefined),
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
  return { authMiddleware, requireOrgAdmin }
})

import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'
import { prisma } from '../../../lib/db'
import { sendSmsOnly } from '../../../services/sms'
import { leadMessagesRoute } from '../messages'

const VALID_LEAD_CUID = 'cmnldqbqa0005gf6cuecae3x1'
const OTHER_ORG_LEAD_CUID = 'cmnildqbqa0005gf6cuecae3x2'

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /leads/:id/messages', () => {
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

  it('cross-org access returns 404 (not 403) — matrix row 9', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null)
    const res = await buildApp().request(`/leads/${OTHER_ORG_LEAD_CUID}/messages`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('NOT_FOUND')
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

  it('persists Message with ERROR status when Twilio send fails (no rollback — staff-visible failure)', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      phone: '+15551234567',
    } as never)
    vi.mocked(sendSmsOnly).mockResolvedValueOnce({
      success: false,
      error: 'TWILIO_RATE_LIMIT',
    } as never)
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([
      {
        id: 'm_failed',
        leadId: VALID_LEAD_CUID,
        twilioStatus: 'ERROR: TWILIO_RATE_LIMIT',
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
    expect(body.error).toBe('TWILIO_RATE_LIMIT')
    // Message row STILL created — staff sees the failed attempt in the thread.
    expect(vi.mocked(prisma.message.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        twilioStatus: 'ERROR: TWILIO_RATE_LIMIT',
        twilioSid: null,
      }),
    })
    expect(vi.mocked(prisma.smsSendLog.create).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'TWILIO_RATE_LIMIT',
      }),
    })
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
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(0)

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
  })

  it('accepts past upTo as-is', async () => {
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(0)

    const pastIso = '2026-04-24T08:00:00Z'
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: pastIso }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { readAt: string }
    expect(body.readAt).toBe(new Date(pastIso).toISOString())
  })

  it('returns 404 when lead not in org', async () => {
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 0 } as never)
    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/messages/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(404)
  })
})
