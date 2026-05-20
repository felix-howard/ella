import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromConversation: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(() => true),
  notifyMissingDocuments: vi.fn(),
  sendBatchMissingReminders: vi.fn(),
  sendSmsOnly: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: { send: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../../services/storage', () => ({
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
  getSafeStorageError: vi.fn(),
  getSafeStorageReference: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/messages/send',
    method: 'POST',
  })),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { sendBatchMissingReminders, sendSmsOnly } from '../../../services/sms'
import { logStaffActivity } from '../../../services/activity-log'
import { messagesRoute } from '../index'

function createApp(userOverrides: Partial<AuthVariables['user']> = {}) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:member',
      ...userOverrides,
    })
    await next()
  })
  app.route('/messages', messagesRoute)
  return app
}

describe('messages activity logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValue({
      id: 'case_1',
      clientId: 'client_1',
      client: {
        id: 'client_1',
        name: 'Client One',
        firstName: 'Client',
        lastName: 'One',
        phone: '+15551234567',
        clientType: 'INDIVIDUAL',
        clientGroupId: null,
      },
    } as never)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue({
      id: 'conv_1',
      caseId: 'case_1',
      taxCase: {
        client: {
          id: 'client_1',
          name: 'Client One',
        },
      },
    } as never)
    vi.mocked(prisma.message.create).mockResolvedValue({
      id: 'msg_1',
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      sentBy: { id: 'staff_1', name: 'Staff User', avatarUrl: null },
    } as never)
    vi.mocked(prisma.message.update).mockResolvedValue({ id: 'msg_1' } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({ id: 'conv_1' } as never)
    vi.mocked(prisma.taxCase.update).mockResolvedValue({ id: 'case_1' } as never)
    vi.mocked(sendSmsOnly).mockResolvedValue({
      success: true,
      sid: 'SM-secret',
      status: 'queued',
    } as never)
  })

  it('logs outbound SMS without content, phone, or Twilio SID', async () => {
    const res = await createApp().request('/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: 'case_1',
        content: 'Sensitive message body',
        channel: 'SMS',
        templateName: 'Missing docs',
      }),
    })

    expect(res.status).toBe(201)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        actorStaffId: 'staff_1',
        action: 'message.sent',
        metadata: expect.objectContaining({
          channel: 'SMS',
          messageId: 'msg_1',
          conversationId: 'conv_1',
          templateName: 'Missing docs',
          smsSent: true,
          twilioStatusCategory: 'queued',
        }),
      })
    )
    const metadata = vi.mocked(logStaffActivity).mock.calls[0][0].metadata as Record<string, unknown>
    expect(JSON.stringify(metadata)).not.toContain('Sensitive message body')
    expect(JSON.stringify(metadata)).not.toContain('+15551234567')
    expect(JSON.stringify(metadata)).not.toContain('SM-secret')
  })

  it('scopes batch reminders to admin organization', async () => {
    vi.mocked(sendBatchMissingReminders).mockResolvedValueOnce({
      sent: 2,
      failed: 0,
      skipped: 1,
      details: [],
    })

    const res = await createApp({ role: 'ADMIN', orgRole: 'org:admin' }).request(
      '/messages/remind-batch',
      { method: 'POST' }
    )

    expect(res.status).toBe(200)
    expect(sendBatchMissingReminders).toHaveBeenCalledWith('org_1')
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        targetType: 'ORGANIZATION',
        targetId: 'org_1',
        action: 'message.batch_reminder_sent',
      })
    )
  })

  it('rejects batch reminders for non-admin staff', async () => {
    const res = await createApp().request('/messages/remind-batch', { method: 'POST' })

    expect(res.status).toBe(403)
    expect(sendBatchMissingReminders).not.toHaveBeenCalled()
  })
})
