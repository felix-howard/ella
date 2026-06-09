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
  leadFindFirstMock,
  leadCountMock,
  leadUpdateManyMock,
  campaignFindUniqueMock,
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
  leadFindFirstMock: vi.fn(),
  leadCountMock: vi.fn(),
  leadUpdateManyMock: vi.fn(),
  campaignFindUniqueMock: vi.fn(),
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
      findFirst: leadFindFirstMock,
      count: leadCountMock,
      updateMany: leadUpdateManyMock,
    },
    campaign: {
      findUnique: campaignFindUniqueMock,
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
  return { authMiddleware, requireOrgAdmin, requireAdminOrManager: requireOrgAdmin }
})

import { Hono } from 'hono'
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const LEAD_1 = 'cmnldqbqa0005gf6cuecae3x1'
const LEAD_2 = 'cmnldqbqa0005gf6cuecae3x2'

function buildApp(userOverride?: Record<string, unknown>) {
  const app = new Hono<{ Variables: AuthVariables }>()
  if (userOverride) {
    app.use('*', async (c, next) => {
      c.set('user', userOverride as never)
      await next()
    })
  }
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
  leadCountMock.mockResolvedValue(2)
  leadFindFirstMock.mockResolvedValue(null)
  campaignFindUniqueMock.mockResolvedValue(null)
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
    const body = (await res.json()) as { success: boolean; sent: number; failed: number; results: unknown[]; limit: number }
    expect(body).toMatchObject({ success: true, sent: 2, failed: 0 })
    expect(body.results).toEqual([
      { leadId: LEAD_1, name: 'Andy', status: 'sent' },
      { leadId: LEAD_2, name: 'Tu', status: 'sent' },
    ])
    expect(body.limit).toBe(200)

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
    expect(leadUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [LEAD_1, LEAD_2] } }),
      data: { status: 'SENT' },
    }))
  })

  it('rejects over-limit requests with count and limit before SMS side effects', async () => {
    const leadIds = Array.from({ length: 201 }, () => LEAD_1)
    const res = await buildApp().request('/leads/bulk-sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadIds,
        message: 'Hi {{firstName}}, book here: {{formLink}}',
        formLinkType: 'org',
      }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'BULK_SMS_LIMIT_EXCEEDED',
      count: 201,
      limit: 200,
    })
    expect(sendSmsOnlyMock).not.toHaveBeenCalled()
    expect(leadFindManyMock).not.toHaveBeenCalled()
  })

  it('does not mark immediate Twilio failures as SENT', async () => {
    sendSmsOnlyMock
      .mockReset()
      .mockResolvedValueOnce({ success: true, sid: 'SM_1', status: 'queued' })
      .mockResolvedValueOnce({ success: false, error: 'TWILIO_ERROR_21211: Invalid To +15557654321' })

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
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      sent: 1,
      failed: 1,
      results: [
        { leadId: LEAD_1, name: 'Andy', status: 'sent' },
        { leadId: LEAD_2, name: 'Tu', status: 'failed', error: 'SMS provider error 21211' },
      ],
    })
    expect(leadUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [LEAD_1] } }),
      data: { status: 'SENT' },
    }))
    expect(messageCreateMock.mock.calls[1][0].data.twilioStatus).toBe('ERROR: SMS provider error 21211')
    expect(messageCreateMock.mock.calls[1][0].data.twilioStatus).not.toContain('+15557654321')
  })

  it('rejects converted leads at the send boundary', async () => {
    leadFindManyMock.mockResolvedValueOnce([
      { id: LEAD_1, firstName: 'Andy', phone: '+15551234567', status: 'NEW' },
      { id: LEAD_2, firstName: 'Tu', phone: '+15557654321', status: 'CONVERTED' },
    ])

    const res = await buildApp().request('/leads/bulk-sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadIds: [LEAD_1, LEAD_2],
        message: 'Hi {{firstName}}, book here: {{formLink}}',
        formLinkType: 'org',
      }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'BULK_SMS_CONVERTED_LEADS',
      leadIds: [LEAD_2],
    })
    expect(sendSmsOnlyMock).not.toHaveBeenCalled()
  })

  it('returns SMS_NOT_CONFIGURED before org, lead, or message side effects', async () => {
    isTwilioConfiguredMock.mockReturnValue(false)

    const res = await buildApp().request('/leads/bulk-sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadIds: [LEAD_1],
        message: 'Hi {{firstName}}, book here: {{formLink}}',
        formLinkType: 'org',
      }),
    })

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'SMS_NOT_CONFIGURED',
      limit: 200,
    })
    expect(orgFindUniqueMock).not.toHaveBeenCalled()
    expect(leadFindManyMock).not.toHaveBeenCalled()
    expect(messageCreateMock).not.toHaveBeenCalled()
  })

  it('does not promote leads when provider send succeeds but persistence fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      leadFindManyMock.mockResolvedValueOnce([
        { id: LEAD_1, firstName: 'Andy', phone: '+15551234567', status: 'NEW' },
      ])
      transactionMock.mockRejectedValueOnce(new Error('Prisma unique violation with internal detail'))

      const res = await buildApp().request('/leads/bulk-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leadIds: [LEAD_1],
          message: 'Hi {{firstName}}, book here: {{formLink}}',
          formLinkType: 'org',
        }),
      })

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        sent: 1,
        failed: 0,
        results: [
          {
            leadId: LEAD_1,
            status: 'sent',
            error: 'Message sent; delivery record unavailable',
          },
        ],
      })
      expect(leadUpdateManyMock).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('does not fail the response when post-send lead status update fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      leadFindManyMock.mockResolvedValueOnce([
        { id: LEAD_1, firstName: 'Andy', phone: '+15551234567', status: 'NEW' },
      ])
      leadUpdateManyMock.mockRejectedValueOnce(new Error('status update failed'))

      const res = await buildApp().request('/leads/bulk-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leadIds: [LEAD_1],
          message: 'Hi {{firstName}}, book here: {{formLink}}',
          formLinkType: 'org',
        }),
      })

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        sent: 1,
        failed: 0,
        results: [{ leadId: LEAD_1, status: 'sent' }],
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Leads] Bulk SMS lead status update failed:',
        expect.any(Error)
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('previews filtered bulk targets up to the shared limit', async () => {
    leadCountMock.mockResolvedValueOnce(250)
    leadFindManyMock.mockResolvedValueOnce([{ id: LEAD_1 }, { id: LEAD_2 }])

    const res = await buildApp().request('/leads/bulk-sms/preview-targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag: 'fb', limit: 2 }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: {
        total: 250,
        selectableTotal: 250,
        returnedIds: [LEAD_1, LEAD_2],
        limit: 200,
        truncated: true,
      },
    })
    expect(leadFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org_1',
        tags: { has: 'fb' },
        status: { not: 'CONVERTED' },
      }),
      take: 2,
      select: { id: true },
    }))
  })

  it('previews converted status as zero selectable targets', async () => {
    leadCountMock.mockResolvedValueOnce(0)
    leadFindManyMock.mockResolvedValueOnce([])

    const res = await buildApp().request('/leads/bulk-sms/preview-targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CONVERTED' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: {
        selectableTotal: 0,
        returnedIds: [],
        truncated: false,
      },
    })
    expect(leadFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org_1',
        status: 'CONVERTED',
        id: { in: [] },
      }),
    }))
  })

  it('returns selectable count and latest SMS delivery status in list response', async () => {
    leadFindManyMock.mockResolvedValueOnce([
      {
        id: LEAD_1,
        firstName: 'Andy',
        lastName: 'Nguyen',
        phone: '+15551234567',
        email: null,
        businessName: null,
        status: 'SENT',
        campaignTag: 'fb',
        tags: ['fb'],
        notes: null,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        convertedToId: null,
        smsSendLogs: [{ status: 'UNDELIVERED', error: 'TWILIO_ERROR_30007: Carrier filtered +15551234567', sentAt: new Date('2026-06-02T00:00:00.000Z') }],
      },
    ])
    leadCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1)

    const res = await buildApp().request('/leads?tag=fb')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      selectableTotal: 1,
      bulkSmsMaxRecipients: 200,
      data: [
        {
          id: LEAD_1,
          latestSms: {
            status: 'UNDELIVERED',
            error: 'SMS provider error 30007',
          },
        },
      ],
    })
  })

  it('sanitizes latest SMS detail errors for manager viewers', async () => {
    leadFindFirstMock.mockResolvedValueOnce({
      id: LEAD_1,
      firstName: 'Andy',
      lastName: 'Nguyen',
      phone: '+15551234567',
      email: null,
      businessName: null,
      status: 'SENT',
      campaignTag: 'fb',
      tags: ['fb'],
      notes: null,
      convertedToId: null,
      convertedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      smsSendLogs: [{
        id: 'log_1',
        status: 'FAILED',
        error: 'TWILIO_ERROR_21612: Cannot send to +15551234567',
        sentAt: new Date('2026-06-02T00:00:00.000Z'),
      }],
    })

    const res = await buildApp({
      id: 'clerk-manager',
      staffId: 'staff_manager',
      organizationId: 'org_1',
      role: 'MANAGER',
      orgRole: 'org:member',
      email: 'manager@test.com',
      name: 'Manager',
      clerkOrgId: 'clerk_org_1',
    }).request(`/leads/${LEAD_1}`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.phone).toBe('*** *** 4567')
    expect(body.data.latestSms.error).toBe('SMS provider error 21612')
    expect(body.data.latestSms.error).not.toContain('+15551234567')
    expect(body.data.smsSendLogs[0].error).toBe('SMS provider error 21612')
    expect(body.data.smsSendLogs[0].error).not.toContain('+15551234567')
    expect(body.data.smsSendLogs[0]).not.toHaveProperty('message')
  })
})
