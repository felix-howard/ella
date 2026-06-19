import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: {
      findFirst: vi.fn(),
    },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    message: {
      count: vi.fn(),
    },
  },
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishConversationReadEvent: vi.fn(() => Promise.resolve()),
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
  getStorageStatus: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { publishConversationReadEvent } from '../../../services/realtime/message-publisher'
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
      role: 'ADMIN',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:admin',
      ...userOverrides,
    })
    await next()
  })
  app.route('/messages', messagesRoute)
  return app
}

describe('POST /messages/:caseId/read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValue({
      id: 'case_1',
      client: { clientType: 'INDIVIDUAL', clientGroupId: null },
    } as never)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue({
      id: 'conv_1',
      caseId: 'case_1',
      unreadCount: 3,
      lastMessageAt: null,
      createdAt: new Date('2026-06-19T14:00:00.000Z'),
      updatedAt: new Date('2026-06-19T14:00:00.000Z'),
    } as never)
    vi.mocked(prisma.conversation.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ unreadCount: 3 } as never)
    vi.mocked(prisma.message.count).mockResolvedValue(0)
  })

  it('clears unread count for an org-scoped case and publishes read event', async () => {
    const readAt = '2026-06-19T06:30:00.000Z'
    const res = await createApp().request('/messages/case_1/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: readAt }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      caseId: 'case_1',
      unreadCount: 0,
      readAt,
    })
    expect(prisma.taxCase.findFirst).toHaveBeenCalledWith({
      where: { id: 'case_1', client: { organizationId: 'org_1' } },
      select: { id: true, client: { select: { clientType: true, clientGroupId: true } } },
    })
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv_1', unreadCount: 3 },
      data: { unreadCount: 0 },
    })
    expect(publishConversationReadEvent).toHaveBeenCalledWith('conv_1', {
      unreadCount: 0,
      readAt,
    })
  })

  it('preserves newer inbound messages after a stale client snapshot', async () => {
    vi.mocked(prisma.message.count).mockResolvedValueOnce(2)
    const readAt = '2026-06-19T06:30:00.000Z'

    const res = await createApp().request('/messages/case_1/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: readAt }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      caseId: 'case_1',
      unreadCount: 2,
      readAt,
    })
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: {
        conversationId: 'conv_1',
        direction: 'INBOUND',
        createdAt: { gt: new Date(readAt) },
      },
    })
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv_1', unreadCount: 3 },
      data: { unreadCount: 2 },
    })
  })

  it('does not increase unread count when upTo predates already-read history', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({
      id: 'conv_1',
      caseId: 'case_1',
      unreadCount: 1,
      lastMessageAt: null,
      createdAt: new Date('2026-06-19T14:00:00.000Z'),
      updatedAt: new Date('2026-06-19T14:00:00.000Z'),
    } as never)
    vi.mocked(prisma.message.count).mockResolvedValueOnce(5)

    const res = await createApp().request('/messages/case_1/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: '2026-01-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      caseId: 'case_1',
      unreadCount: 1,
    })
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv_1', unreadCount: 1 },
      data: { unreadCount: 1 },
    })
  })

  it('retries when an inbound unread increment wins the first update race', async () => {
    vi.mocked(prisma.message.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
    vi.mocked(prisma.conversation.updateMany)
      .mockResolvedValueOnce({ count: 0 } as never)
      .mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({ unreadCount: 4 } as never)

    const res = await createApp().request('/messages/case_1/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ upTo: '2026-06-19T06:30:00.000Z' }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      caseId: 'case_1',
      unreadCount: 1,
    })
    expect(prisma.conversation.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'conv_1', unreadCount: 3 },
      data: { unreadCount: 0 },
    })
    expect(prisma.conversation.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'conv_1', unreadCount: 4 },
      data: { unreadCount: 1 },
    })
  })

  it('returns 404 for cross-org case without mutating unread state', async () => {
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValueOnce(null)

    const res = await createApp().request('/messages/case_1/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(404)
    expect(prisma.conversation.upsert).not.toHaveBeenCalled()
    expect(prisma.conversation.updateMany).not.toHaveBeenCalled()
    expect(publishConversationReadEvent).not.toHaveBeenCalled()
  })
})
