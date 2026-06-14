import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    message: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    rawImage: {
      findMany: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    taxCase: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/ai', () => ({
  translateMessageToEnglish: vi.fn(),
}))

vi.mock('../../../services/realtime/message-publisher', () => ({
  publishMessageEventFromConversation: vi.fn(),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn(() => false),
  notifyMissingDocuments: vi.fn(),
  sendBatchMissingReminders: vi.fn(),
  sendSmsOnly: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: { send: vi.fn() },
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
  resolveAvatarUrl: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { translateMessageToEnglish } from '../../../services/ai'
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

describe('message translation route', () => {
  beforeEach(() => {
    __resetRateLimitMapForTests()
    vi.clearAllMocks()
    vi.mocked(prisma.message.findFirst).mockResolvedValue({
      id: 'msg_1',
      content: 'chị gửi giấy thuế giúp em',
      channel: 'SMS',
    } as never)
    vi.mocked(translateMessageToEnglish).mockResolvedValue({
      success: true,
      sourceLanguage: 'unknown',
      targetLanguage: 'EN',
      translatedText: 'Please send your tax documents.',
    })
  })

  it('translates an org-scoped message without accepting browser-sent text', async () => {
    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN', content: 'tampered' }),
      headers: { 'content-type': 'application/json' },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      messageId: 'msg_1',
      sourceLanguage: 'unknown',
      targetLanguage: 'EN',
      translatedText: 'Please send your tax documents.',
    })
    expect(prisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'msg_1',
          conversation: expect.any(Object),
        }),
      })
    )
    expect(translateMessageToEnglish).toHaveBeenCalledWith('chị gửi giấy thuế giúp em')
  })

  it('returns 404 when message is outside org scope or missing', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    const res = await createApp().request('/messages/msg_other/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(404)
    expect(translateMessageToEnglish).not.toHaveBeenCalled()
  })

  it('returns a stable error code for unsupported target languages', async () => {
    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'VI' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'UNSUPPORTED_TARGET_LANGUAGE' })
    expect(prisma.message.findFirst).not.toHaveBeenCalled()
    expect(translateMessageToEnglish).not.toHaveBeenCalled()
  })

  it('rejects empty and system messages before translation', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      id: 'msg_1',
      content: 'System event',
      channel: 'SYSTEM',
    } as never)

    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'EMPTY_MESSAGE' })
    expect(translateMessageToEnglish).not.toHaveBeenCalled()
  })

  it('rejects call and empty image-only messages before translation', async () => {
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      id: 'msg_call',
      content: 'Call completed',
      channel: 'CALL',
    } as never)

    const callRes = await createApp().request('/messages/msg_call/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(callRes.status).toBe(400)
    expect(await callRes.json()).toMatchObject({ error: 'EMPTY_MESSAGE' })

    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({
      id: 'msg_image',
      content: '   ',
      channel: 'SMS',
    } as never)

    const imageOnlyRes = await createApp().request('/messages/msg_image/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(imageOnlyRes.status).toBe(400)
    expect(await imageOnlyRes.json()).toMatchObject({ error: 'EMPTY_MESSAGE' })
    expect(translateMessageToEnglish).not.toHaveBeenCalled()
  })

  it('returns 503 when Gemini is not configured', async () => {
    vi.mocked(translateMessageToEnglish).mockResolvedValueOnce({
      success: false,
      error: 'AI_NOT_CONFIGURED',
    })

    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'AI_NOT_CONFIGURED' })
  })

  it('maps generic translation failures to 502', async () => {
    vi.mocked(translateMessageToEnglish).mockResolvedValueOnce({
      success: false,
      error: 'TRANSLATION_FAILED',
    })

    const res = await createApp().request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'TRANSLATION_FAILED' })
  })

  it('rate-limits translation requests per staff account', async () => {
    const app = createApp()

    for (let i = 0; i < 10; i++) {
      const allowed = await app.request('/messages/msg_1/translate', {
        method: 'POST',
        body: JSON.stringify({ targetLanguage: 'EN' }),
        headers: { 'content-type': 'application/json' },
      })
      expect(allowed.status).toBe(200)
    }

    const limited = await app.request('/messages/msg_1/translate', {
      method: 'POST',
      body: JSON.stringify({ targetLanguage: 'EN' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({ error: 'RATE_LIMIT_EXCEEDED' })
  })
})
