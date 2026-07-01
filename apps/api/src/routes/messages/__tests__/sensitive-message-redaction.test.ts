import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: { findFirst: vi.fn() },
    conversation: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      upsert: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/ai', () => ({
  translateMessageToEnglish: vi.fn(),
  translateReplyToVietnamese: vi.fn(),
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishConversationReadEvent: vi.fn(() => Promise.resolve()),
  publishMessageEventFromConversation: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(() => false),
  notifyMissingDocuments: vi.fn(),
  sendBatchMissingReminders: vi.fn(),
  sendSmsOnly: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: { send: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../../services/storage', () => ({
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
  getSafeStorageError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  })),
  getSafeStorageReference: vi.fn((key: string) => ({
    objectType: key.split('/')[0] || 'unknown',
    keyHash: 'safehash',
  })),
  getSignedDownloadUrl: vi.fn(),
  getStorageStatus: vi.fn(),
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { translateMessageToEnglish } from '../../../services/ai'
import { messagesRoute } from '../index'

const now = new Date('2026-06-29T10:00:00.000Z')
const sensitiveContent =
  'Quote $7,000: https://my.ella.tax/quote/tok_quote Pay: https://my.ella.tax/pay/tok_pay Agreement: https://my.ella.tax/agreements/tok_agreement'
const sensitiveStaffContent = 'Please review the $7,000 quote, pay link, and agreement link.'

function createApp(userOverrides: Partial<AuthVariables['user']> = {}) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'MANAGER',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:member',
      ...userOverrides,
    })
    await next()
  })
  app.route('/messages', messagesRoute)
  return app
}

function sensitiveMessage() {
  return {
    id: 'msg_1',
    content: sensitiveContent,
    contentLanguage: 'EN',
    staffAuthoredContent: sensitiveStaffContent,
    staffAuthoredLanguage: 'EN',
    translationEdited: false,
    channel: 'SMS',
    direction: 'OUTBOUND',
    templateUsed: 'quote_pay_link',
    twilioStatus: 'queued',
    attachmentUrls: [],
    attachmentR2Keys: ['message-attachments/org_1/case_1/private.png'],
    sentBy: { id: 'staff_1', name: 'Staff User', avatarUrl: null },
    createdAt: now,
    updatedAt: now,
  }
}

function mockConversationList() {
  vi.mocked(prisma.conversation.findMany).mockResolvedValue([
    {
      id: 'conv_1',
      caseId: 'case_1',
      unreadCount: 0,
      replyMode: 'SMS',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      taxCase: {
        id: 'case_1',
        taxYear: 2025,
        status: 'NEW',
        client: {
          id: 'client_1',
          name: 'Client One',
          phone: '+15551234567',
          language: 'EN',
          clientType: 'INDIVIDUAL',
          clientGroupId: null,
          clientGroup: null,
        },
      },
      messages: [sensitiveMessage()],
    },
  ] as never)
}

function mockThreadMessages() {
  vi.mocked(prisma.taxCase.findFirst).mockResolvedValue({
    id: 'case_1',
    client: { clientType: 'INDIVIDUAL', clientGroupId: null },
  } as never)
  vi.mocked(prisma.conversation.upsert).mockResolvedValue({
    id: 'conv_1',
    caseId: 'case_1',
    unreadCount: 0,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  } as never)
  vi.mocked(prisma.message.findMany).mockResolvedValue([sensitiveMessage()] as never)
}

function expectNoSensitiveLeak(payload: unknown) {
  const rawBody = JSON.stringify(payload)
  expect(rawBody).not.toContain('/quote/')
  expect(rawBody).not.toContain('/pay/')
  expect(rawBody).not.toContain('/agreements/')
  expect(rawBody).not.toContain('$7,000')
  expect(rawBody).not.toContain('message-attachments/')
  expect(rawBody).not.toContain('attachmentR2Keys')
}

describe('message route sensitive redaction', () => {
  beforeEach(() => {
    __resetRateLimitMapForTests()
    vi.clearAllMocks()
    vi.mocked(prisma.conversation.count).mockResolvedValue(1)
    vi.mocked(prisma.conversation.aggregate).mockResolvedValue({ _sum: { unreadCount: 0 } } as never)
    vi.mocked(prisma.message.count).mockResolvedValue(1)
    vi.mocked(translateMessageToEnglish).mockResolvedValue({
      success: true,
      sourceLanguage: 'unknown',
      targetLanguage: 'EN',
      translatedText: 'Pay $7,000 here.',
    })
  })

  it('redacts manager conversation previews without leaking raw payment content', async () => {
    mockConversationList()

    const res = await createApp().request('/messages/conversations')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.conversations[0].lastMessage.content).toBe('A payment link was sent to the client.')
    expect(json.conversations[0].lastMessage.staffAuthoredContent).toBeNull()
    expect(json.conversations[0].lastMessage.templateUsed).toBe('quote_pay_link')
    expect(json.conversations[0].lastMessage.twilioStatus).toBe('queued')
    expect(json.conversations[0].lastMessage.updatedAt).toBe(now.toISOString())
    expectNoSensitiveLeak(json)
  })

  it('redacts manager thread messages without leaking raw payment content', async () => {
    mockThreadMessages()

    const res = await createApp().request('/messages/case_1')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.messages[0].content).toBe('A payment link was sent to the client.')
    expect(json.messages[0].staffAuthoredContent).toBeNull()
    expect(json.messages[0].twilioStatus).toBe('queued')
    expectNoSensitiveLeak(json)
  })

  it('keeps admin conversation and thread content unchanged', async () => {
    const admin = { role: 'ADMIN', orgRole: 'org:admin' }
    mockConversationList()
    const listJson = await (await createApp(admin).request('/messages/conversations')).json()

    mockThreadMessages()
    const threadJson = await (await createApp(admin).request('/messages/case_1')).json()

    expect(listJson.conversations[0].lastMessage.content).toBe(sensitiveContent)
    expect(listJson.conversations[0].lastMessage.staffAuthoredContent).toBe(sensitiveStaffContent)
    expect(listJson.conversations[0].lastMessage.templateUsed).toBe('quote_pay_link')
    expect(threadJson.messages[0].content).toBe(sensitiveContent)
    expect(threadJson.messages[0].staffAuthoredContent).toBe(sensitiveStaffContent)
  })

  it('blocks manager translation for redacted messages before calling AI', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValue(sensitiveMessage() as never)

    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'SENSITIVE_MESSAGE_REDACTED' })
    expect(translateMessageToEnglish).not.toHaveBeenCalled()
  })

  it('allows admin translation for sensitive messages', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValue(sensitiveMessage() as never)

    const res = await createApp({ role: 'ADMIN', orgRole: 'org:admin' }).request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(translateMessageToEnglish).toHaveBeenCalledWith(sensitiveContent)
  })
})
