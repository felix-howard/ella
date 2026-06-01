/**
 * Lead bulk SMS tests.
 *
 * Pins that bulk sends create staff-visible Message rows, not only SmsSendLog
 * audit rows, so the lead floating chat shows outbound bulk SMS history.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  orgFindUniqueMock,
  leadFindManyMock,
  leadUpdateManyMock,
  messageCreateMock,
  smsSendLogCreateMock,
  transactionMock,
  sendSmsOnlyMock,
  isTwilioConfiguredMock,
  publishMessageEventMock,
  logStaffActivityMock,
} = vi.hoisted(() => ({
  orgFindUniqueMock: vi.fn(),
  leadFindManyMock: vi.fn(),
  leadUpdateManyMock: vi.fn(),
  messageCreateMock: vi.fn(),
  smsSendLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  sendSmsOnlyMock: vi.fn(),
  isTwilioConfiguredMock: vi.fn(),
  publishMessageEventMock: vi.fn(),
  logStaffActivityMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: {
      findUnique: orgFindUniqueMock,
    },
    staff: {
      findFirst: vi.fn(),
    },
    lead: {
      findMany: leadFindManyMock,
      updateMany: leadUpdateManyMock,
    },
    message: {
      create: messageCreateMock,
    },
    smsSendLog: {
      create: smsSendLogCreateMock,
    },
    $transaction: transactionMock,
  },
}))

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: (phone: string) => phone,
  sendSmsOnly: sendSmsOnlyMock,
  isTwilioConfigured: isTwilioConfiguredMock,
  sendWelcomeMessage: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEvent: publishMessageEventMock,
}))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (s: string) => s,
  sanitizeTextInput: (s: string) => s,
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/leads/bulk-sms',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn(),
  logStaffActivity: logStaffActivityMock,
  logSystemActivity: vi.fn(),
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
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const LEAD_1 = 'cmnldqbqa0005gf6cuecae3x1'
const LEAD_2 = 'cmnldqbqa0005gf6cuecae3x2'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/leads', leadsRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  orgFindUniqueMock.mockResolvedValue({ slug: 'ella-tax', clerkOrgId: 'clerk_org_1' })
  leadFindManyMock.mockResolvedValue([
    { id: LEAD_1, firstName: 'Andy', phone: '+15551234567' },
    { id: LEAD_2, firstName: 'Tu', phone: '+15557654321' },
  ])
  leadUpdateManyMock.mockResolvedValue({ count: 2 })
  sendSmsOnlyMock
    .mockResolvedValueOnce({ success: true, sid: 'SM_1', status: 'queued' })
    .mockResolvedValueOnce({ success: true, sid: 'SM_2', status: 'sent' })
  isTwilioConfiguredMock.mockReturnValue(true)

  let transactionCount = 0
  transactionMock.mockImplementation(async () => {
    transactionCount += 1
    return [{ id: `msg_${transactionCount}` }, { id: `log_${transactionCount}` }]
  })
  publishMessageEventMock.mockResolvedValue(undefined)
  logStaffActivityMock.mockResolvedValue(undefined)
})

describe('POST /leads/bulk-sms', () => {
  it('dual-writes Message + SmsSendLog for each lead so bulk SMS appears in lead chat', async () => {
    const res = await buildApp().request('/leads/bulk-sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadIds: [LEAD_1, LEAD_2],
        message: 'Hi {{firstName}}, book here: {{formLink}}',
        formLinkType: 'org',
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; sent: number; failed: number }
    expect(body).toMatchObject({ success: true, sent: 2, failed: 0 })

    expect(messageCreateMock).toHaveBeenCalledTimes(2)
    expect(messageCreateMock.mock.calls[0][0]).toMatchObject({
      data: {
        leadId: LEAD_1,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content: 'Hi Andy, book here: http://localhost:5173/form/ella-tax',
        twilioSid: 'SM_1',
        twilioStatus: 'queued',
        sentById: 'staff_1',
      },
    })
    expect(messageCreateMock.mock.calls[1][0]).toMatchObject({
      data: expect.objectContaining({
        leadId: LEAD_2,
        content: 'Hi Tu, book here: http://localhost:5173/form/ella-tax',
        twilioSid: 'SM_2',
        twilioStatus: 'sent',
      }),
    })

    expect(smsSendLogCreateMock).toHaveBeenCalledTimes(2)
    expect(transactionMock).toHaveBeenCalledTimes(2)
    expect(publishMessageEventMock).toHaveBeenCalledTimes(2)
    expect(publishMessageEventMock).toHaveBeenCalledWith(
      'clerk_org_1',
      expect.objectContaining({ leadId: LEAD_1, messageId: 'msg_1' })
    )
    expect(logStaffActivityMock).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ messageIds: ['msg_1', 'msg_2'] }),
    }))
  })
})
