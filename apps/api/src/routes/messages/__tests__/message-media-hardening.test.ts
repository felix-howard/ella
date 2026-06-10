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
    },
    client: {
      findMany: vi.fn(),
    },
  },
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
  inngest: {
    send: vi.fn(),
  },
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

import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../../services/storage'
import { messagesRoute } from '../index'

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
  })
  await next()
})
app.route('/messages', messagesRoute)

describe('message media hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.message.findFirst).mockResolvedValue({
      attachmentR2Keys: ['cases/case_1/raw/private.png'],
      attachmentUrls: [],
      conversation: { caseId: 'case_1' },
    } as never)
    vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com/private.png')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('image bytes', {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      )
    )
  })

  it('uses short signed URL TTL and no-store headers for proxied MMS media', async () => {
    const res = await app.request('/messages/media/msg_1/0')
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('image bytes')
    expect(getSignedDownloadUrl).toHaveBeenCalledWith('cases/case_1/raw/private.png', 900)
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(res.headers.get('pragma')).toBe('no-cache')
    expect(res.headers.get('expires')).toBe('0')
  })
})
