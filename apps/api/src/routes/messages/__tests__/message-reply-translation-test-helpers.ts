import { Hono } from 'hono'
import { vi } from 'vitest'
import type { AuthVariables } from '../../../middleware/auth'
import type { messagesRoute as messagesRouteExport } from '../index'

function createPrismaMock() {
  return {
    taxCase: { findFirst: vi.fn(), update: vi.fn() },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    message: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    rawImage: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
  }
}

function registerRouteMocks() {
  vi.doMock('../../../lib/db', () => ({ prisma: createPrismaMock() }))
  vi.doMock('../../../services/ai', () => ({
    translateMessageToEnglish: vi.fn(),
    translateReplyToVietnamese: vi.fn(),
  }))
  vi.doMock('../../../services/realtime/message-publisher', () => ({
    publishConversationReadEvent: vi.fn(),
    publishMessageEventFromConversation: vi.fn(() => Promise.resolve()),
  }))
  vi.doMock('../../../services/sms', () => ({
    isSmsEnabled: vi.fn(() => true),
    notifyMissingDocuments: vi.fn(),
    sendBatchMissingReminders: vi.fn(),
    sendSmsOnly: vi.fn(),
  }))
  vi.doMock('../../../lib/inngest', () => ({
    inngest: { send: vi.fn(() => Promise.resolve()) },
  }))
  vi.doMock('../../../services/storage', () => ({
    SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
    getSafeStorageError: vi.fn((error: unknown) => ({
      message: error instanceof Error ? error.message : String(error),
    })),
    getSafeStorageReference: vi.fn((key: string) => ({ objectType: key.split('/')[0] || 'unknown', keyHash: 'safehash' })),
    getSignedDownloadUrl: vi.fn(),
    getStorageStatus: vi.fn(() => ({ configured: true, bucket: 'test', endpoint: 'https://r2.test' })),
    resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(() => Promise.resolve(true)),
  }))
  vi.doMock('../../../services/activity-log', () => ({
    getAuditRequestContext: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest', route: '/messages/send', method: 'POST' })),
    logStaffActivity: vi.fn(),
  }))
}

function createAppForRoute(
  messagesRoute: typeof messagesRouteExport,
  userOverrides: Partial<AuthVariables['user']> = {}
) {
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

export function defaultTaxCase() {
  return {
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
  }
}

export function defaultConversation() {
  return {
    id: 'conv_1',
    caseId: 'case_1',
    replyMode: 'DIRECT',
    taxCase: { client: defaultTaxCase().client },
  }
}

export function defaultMessage(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-29T00:00:00.000Z')
  return {
    id: 'msg_1',
    content: 'Em cần anh/chị gửi W-2 năm 2025.',
    contentLanguage: 'VI',
    staffAuthoredContent: 'Please send your 2025 W-2.',
    staffAuthoredLanguage: 'EN',
    translationEdited: true,
    channel: 'SMS',
    direction: 'OUTBOUND',
    attachmentUrls: [],
    attachmentR2Keys: [],
    createdAt: now,
    updatedAt: now,
    sentBy: { id: 'staff_1', name: 'Staff User', avatarUrl: null },
    ...overrides,
  }
}

export function translationForm() {
  const form = new FormData()
  form.append('caseId', 'case_1')
  form.append('content', 'Em cần anh/chị gửi W-2 năm 2025.')
  form.append('staffAuthoredContent', 'Please send your 2025 W-2.')
  form.append('staffAuthoredLanguage', 'EN')
  form.append('contentLanguage', 'VI')
  form.append('translationEdited', 'false')
  return form
}

export async function loadReplyTranslationTestHarness() {
  vi.resetModules()
  registerRouteMocks()

  const { prisma } = await import('../../../lib/db')
  const { __resetRateLimitMapForTests } = await import('../../../middleware/rate-limiter')
  const { translateReplyToVietnamese } = await import('../../../services/ai')
  const { sendSmsOnly } = await import('../../../services/sms')
  const { logStaffActivity } = await import('../../../services/activity-log')
  const { messagesRoute } = await import('../index')

  function setupReplyTranslationMocks() {
    __resetRateLimitMapForTests()
    vi.clearAllMocks()
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValue(defaultTaxCase() as never)
    vi.mocked(prisma.taxCase.update).mockResolvedValue({ id: 'case_1' } as never)
    vi.mocked(prisma.conversation.upsert).mockResolvedValue(defaultConversation() as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({ id: 'conv_1' } as never)
    vi.mocked(prisma.message.create).mockResolvedValue(defaultMessage() as never)
    vi.mocked(prisma.message.update).mockResolvedValue({ id: 'msg_1' } as never)
    vi.mocked(sendSmsOnly).mockResolvedValue({ success: true, sid: 'SM-secret', status: 'queued' } as never)
    vi.mocked(translateReplyToVietnamese).mockResolvedValue({
      success: true,
      sourceLanguage: 'EN',
      targetLanguage: 'VI',
      translatedText: 'Em cần anh/chị gửi W-2 năm 2025.',
    })
  }

  return {
    prisma,
    translateReplyToVietnamese,
    sendSmsOnly,
    logStaffActivity,
    createApp: (userOverrides?: Partial<AuthVariables['user']>) =>
      createAppForRoute(messagesRoute, userOverrides),
    setupReplyTranslationMocks,
  }
}
