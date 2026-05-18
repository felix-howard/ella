import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isGeminiConfigured: false,
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    rawImage: {
      create: vi.fn(),
    },
    action: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: {
      accountSid: null,
      authToken: null,
    },
  },
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

vi.mock('../../ai', () => ({
  get isGeminiConfigured() {
    return mocks.isGeminiConfigured
  },
}))

vi.mock('../../storage', () => ({
  generateFileKey: vi.fn(() => 'cases/case_1/raw/private-driver-license.png'),
  getSafeStorageError: vi.fn((error: unknown) => ({
    name: error instanceof Error ? error.name : undefined,
    message:
      error instanceof Error
        ? error.message
            .replace(/https?:\/\/\S+/g, '[REDACTED_URL]')
            .replace(/cases\/\S+/g, '[REDACTED_KEY]')
        : 'Unknown error',
  })),
  getSafeStorageReference: vi.fn((key: string) => ({
    objectType: key.split('/')[0] || 'unknown',
    keyHash: 'safehash',
  })),
  getSignedDownloadUrl: vi.fn(),
  getStorageStatus: vi.fn(() => ({
    configured: true,
    bucket: 'test-bucket',
    endpoint: 'https://r2.example.com',
  })),
  uploadFile: vi.fn(() => {
    throw new Error(
      'upload failed for cases/case_1/raw/private-driver-license.png at https://signed.example.com/file.png?token=secret'
    )
  }),
}))

import { processMmsMedia } from '../mms-media-handler'
import { prisma } from '../../../lib/db'
import { inngest } from '../../../lib/inngest'
import { uploadFile } from '../../storage'

describe('MMS media handler logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isGeminiConfigured = false
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

  it('does not re-log raw R2 keys or signed URLs when upload fails', async () => {
    const result = await processMmsMedia(
      {
        MessageSid: 'SM123',
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15557654321',
        Body: '',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/media/private',
        MediaContentType0: 'image/png',
      },
      'case_1'
    )

    const serialized = JSON.stringify({
      errors: result.errors,
      consoleErrors: vi.mocked(console.error).mock.calls,
      consoleWarnings: vi.mocked(console.warn).mock.calls,
    })

    expect(serialized).not.toContain('cases/case_1/raw/private-driver-license.png')
    expect(serialized).not.toContain('https://signed.example.com')
    expect(serialized).toContain('[REDACTED_KEY]')
    expect(serialized).toContain('[REDACTED_URL]')
  })

  it('does not log raw R2 keys or signed URLs when classification queueing fails', async () => {
    mocks.isGeminiConfigured = true
    vi.mocked(uploadFile).mockResolvedValueOnce({
      key: 'cases/case_1/raw/private-driver-license.png',
      url: 'https://signed.example.com/file.png?token=secret',
    })
    vi.mocked(prisma.rawImage.create).mockResolvedValue({ id: 'img_1' } as never)
    vi.mocked(inngest.send).mockRejectedValueOnce(
      new Error(
        'queue failed for cases/case_1/raw/private-driver-license.png at https://signed.example.com/file.png?token=secret'
      )
    )

    await processMmsMedia(
      {
        MessageSid: 'SM123',
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15557654321',
        Body: '',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/media/private',
        MediaContentType0: 'image/png',
      },
      'case_1'
    )

    const serialized = JSON.stringify({
      consoleErrors: vi.mocked(console.error).mock.calls,
    })

    expect(serialized).not.toContain('cases/case_1/raw/private-driver-license.png')
    expect(serialized).not.toContain('https://signed.example.com')
    expect(serialized).toContain('[REDACTED_KEY]')
    expect(serialized).toContain('[REDACTED_URL]')
  })
})
