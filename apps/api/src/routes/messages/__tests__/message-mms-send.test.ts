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
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    message: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    rawImage: {
      findMany: vi.fn(),
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
  getSafeStorageError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  })),
  getSafeStorageReference: vi.fn((key: string) => ({
    objectType: key.split('/')[0] || 'unknown',
    keyHash: 'safehash',
  })),
  getSignedDownloadUrl: vi.fn(),
  getStorageStatus: vi.fn(() => ({ configured: true, bucket: 'test', endpoint: 'https://r2.test' })),
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/messages/send-with-attachments',
    method: 'POST',
  })),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { sendSmsOnly } from '../../../services/sms'
import { deleteFile, getStorageStatus, uploadFile } from '../../../services/storage'
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

function defaultImageBytes(type: string): ArrayBuffer {
  if (type === 'image/png') {
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer
  }
  if (type === 'image/jpeg') {
    return new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer
  }
  if (type === 'image/gif') {
    return new TextEncoder().encode('GIF89a').buffer
  }
  return new Uint8Array([1, 2, 3]).buffer
}

function imageForm(options: { caseId?: string; content?: string; files?: Array<{ type: string; name: string; bytes?: ArrayBuffer }> } = {}) {
  const form = new FormData()
  form.append('caseId', options.caseId ?? 'case_1')
  if (options.content !== undefined) form.append('content', options.content)
  for (const file of options.files ?? []) {
    const bytes = file.bytes ?? defaultImageBytes(file.type)
    form.append('images', new Blob([bytes], { type: file.type }), file.name)
  }
  return form
}

describe('message MMS send route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStorageStatus).mockReturnValue({
      configured: true,
      bucket: 'test',
      endpoint: 'https://r2.test',
    })
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
      taxCase: { client: { id: 'client_1', name: 'Client One' } },
    } as never)
    vi.mocked(prisma.conversation.count).mockResolvedValue(1)
    vi.mocked(prisma.conversation.aggregate).mockResolvedValue({
      _sum: { unreadCount: 0 },
    } as never)
    vi.mocked(prisma.message.create).mockResolvedValue({
      id: 'msg_1',
      content: '',
      channel: 'SMS',
      direction: 'OUTBOUND',
      attachmentUrls: ['https://signed.example.com/photo.png'],
      attachmentR2Keys: ['message-attachments/org_1/case_1/upload/1.png'],
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
      sentBy: { id: 'staff_1', name: 'Staff User', avatarUrl: null },
    } as never)
    vi.mocked(prisma.message.update).mockResolvedValue({ id: 'msg_1' } as never)
    vi.mocked(prisma.conversation.update).mockResolvedValue({ id: 'conv_1' } as never)
    vi.mocked(prisma.taxCase.update).mockResolvedValue({ id: 'case_1' } as never)
    vi.mocked(uploadFile).mockResolvedValue({
      key: 'message-attachments/org_1/case_1/upload/1.png',
      url: 'https://signed.example.com/photo.png',
    })
    vi.mocked(sendSmsOnly).mockResolvedValue({
      success: true,
      sid: 'SM-secret',
      status: 'queued',
    } as never)
  })

  it('uploads image-only MMS, stores attachment keys, and returns proxy URLs', async () => {
    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        files: [{ type: 'image/png', name: 'photo.png' }],
      }),
    })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringMatching(/^message-attachments\/org_1\/case_1\/.+\/1\.png$/),
      expect.any(Buffer),
      'image/png'
    )
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: '',
          attachmentUrls: ['https://signed.example.com/photo.png'],
          attachmentR2Keys: ['message-attachments/org_1/case_1/upload/1.png'],
        }),
      })
    )
    expect(sendSmsOnly).toHaveBeenCalledWith('+15551234567', '', {
      mediaUrls: ['https://signed.example.com/photo.png'],
    })
    expect(json.message.attachmentUrls).toEqual(['/messages/media/msg_1/0'])
    expect(JSON.stringify(json)).not.toContain('attachmentR2Keys')
    expect(JSON.stringify(json)).not.toContain('message-attachments/')
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Sent MMS to client',
        metadata: expect.objectContaining({
          attachmentCount: 1,
          twilioStatusCategory: 'queued',
        }),
      })
    )
  })

  it('rejects multipart sends with no content and no images before lookup or upload', async () => {
    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({ content: '   ' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'EMPTY_MESSAGE' })
    )
    expect(prisma.taxCase.findFirst).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
    expect(sendSmsOnly).not.toHaveBeenCalled()
  })

  it('returns proxy attachment URLs and omits storage internals from conversation list', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([
      {
        id: 'conv_1',
        caseId: 'case_1',
        unreadCount: 0,
        lastMessageAt: new Date('2026-06-10T00:00:00.000Z'),
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
        updatedAt: new Date('2026-06-10T00:00:00.000Z'),
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
        messages: [
          {
            id: 'msg_1',
            content: '',
            channel: 'SMS',
            direction: 'OUTBOUND',
            createdAt: new Date('2026-06-10T00:00:00.000Z'),
            updatedAt: new Date('2026-06-10T00:00:00.000Z'),
            attachmentUrls: ['https://signed.example.com/photo.png'],
            attachmentR2Keys: ['message-attachments/org_1/case_1/upload/1.png'],
            sentBy: { id: 'staff_1', name: 'Staff User', avatarUrl: null },
          },
        ],
      },
    ] as never)

    const res = await createApp().request('/messages/conversations')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.conversations[0].lastMessage.attachmentUrls).toEqual(['/messages/media/msg_1/0'])
    expect(JSON.stringify(json)).not.toContain('attachmentR2Keys')
    expect(JSON.stringify(json)).not.toContain('https://signed.example.com/photo.png')
    expect(JSON.stringify(json)).not.toContain('message-attachments/')
  })

  it('rejects unsupported image types before lookup or upload', async () => {
    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        content: 'See file',
        files: [{ type: 'application/pdf', name: 'file.pdf' }],
      }),
    })

    expect(res.status).toBe(400)
    expect(prisma.taxCase.findFirst).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects image files whose content does not match the MIME type', async () => {
    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        content: 'Spoofed',
        files: [{ type: 'image/png', name: 'spoof.png', bytes: new Uint8Array([1, 2, 3]).buffer }],
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'INVALID_ATTACHMENT_CONTENT' })
    )
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects more than four images', async () => {
    const files = Array.from({ length: 5 }, (_, index) => ({
      type: 'image/jpeg',
      name: `photo-${index}.jpg`,
    }))

    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({ content: 'Too many', files }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'TOO_MANY_ATTACHMENTS' })
    )
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects attachments above the MMS payload limit', async () => {
    const oversizedJpeg = new Uint8Array(5 * 1024 * 1024 + 1)
    oversizedJpeg[0] = 0xff
    oversizedJpeg[1] = 0xd8
    oversizedJpeg[2] = 0xff

    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        content: 'Large',
        files: [{ type: 'image/jpeg', name: 'large.jpg', bytes: oversizedJpeg.buffer }],
      }),
    })

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'ATTACHMENTS_TOO_LARGE' })
    )
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects image messages when storage is not configured before creating a message', async () => {
    vi.mocked(getStorageStatus).mockReturnValue({
      configured: false,
      bucket: 'test',
      endpoint: null,
    })

    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        content: 'Photo',
        files: [{ type: 'image/png', name: 'photo.png' }],
      }),
    })

    expect(res.status).toBe(503)
    expect(prisma.taxCase.findFirst).not.toHaveBeenCalled()
    expect(prisma.message.create).not.toHaveBeenCalled()
  })

  it('deletes uploaded attachments when message persistence fails', async () => {
    vi.mocked(prisma.message.create).mockRejectedValueOnce(new Error('database unavailable'))

    const res = await createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: imageForm({
        content: 'Photo',
        files: [{ type: 'image/png', name: 'photo.png' }],
      }),
    })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'MESSAGE_CREATE_FAILED' })
    )
    expect(uploadFile).toHaveBeenCalled()
    expect(deleteFile).toHaveBeenCalledWith('message-attachments/org_1/case_1/upload/1.png')
    expect(sendSmsOnly).not.toHaveBeenCalled()
  })
})
