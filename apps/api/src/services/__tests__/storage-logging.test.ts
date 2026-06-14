import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockSend: ReturnType<typeof vi.fn>
let mockGetSignedUrl: ReturnType<typeof vi.fn>

vi.mock('@aws-sdk/client-s3', () => {
  mockSend = vi.fn()
  return {
    S3Client: class {
      send = mockSend
    },
    PutObjectCommand: class {},
    GetObjectCommand: class {},
    CopyObjectCommand: class {},
    DeleteObjectCommand: class {},
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => {
  mockGetSignedUrl = vi.fn()
  return {
    getSignedUrl: mockGetSignedUrl,
  }
})

vi.mock('../../lib/db', () => ({
  prisma: {
    rawImage: {
      findUnique: vi.fn(),
    },
  },
}))

Object.assign(process.env, {
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  R2_BUCKET_NAME: 'test-bucket',
})

const storage = await import('../storage')

function serializedConsoleCalls(mock: ReturnType<typeof vi.fn>): string {
  return JSON.stringify(mock.mock.calls)
}

describe('storage signed URL and logging hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSend.mockResolvedValue({})
    mockGetSignedUrl.mockResolvedValue('https://signed.example.com/private.pdf?token=secret')
  })

  it('uses 15-minute signed download URLs by default for sensitive documents', async () => {
    await storage.getSignedDownloadUrl('cases/case_1/docs/2025_W2_John.pdf')

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: storage.SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS }
    )
  })

  it('keeps avatar signed URLs on the longer avatar TTL', async () => {
    await storage.resolveAvatarUrl('avatars/staff_1/profile.jpg')

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: storage.AVATAR_SIGNED_URL_TTL_SECONDS }
    )
  })

  it('does not log raw R2 keys or signed URLs during upload', async () => {
    const key = 'cases/case_1/docs/2025_W2_John.pdf'

    await storage.uploadFile(key, Buffer.from('pdf'), 'application/pdf')

    const logs = [
      serializedConsoleCalls(vi.mocked(console.log)),
      serializedConsoleCalls(vi.mocked(console.warn)),
      serializedConsoleCalls(vi.mocked(console.error)),
    ].join('\n')

    expect(logs).not.toContain(key)
    expect(logs).not.toContain('2025_W2_John.pdf')
    expect(logs).not.toContain('https://signed.example.com')
    expect(logs).toContain('keyHash')
  })

  it.each([
    {
      key: 'cases/case_1/docs/2025_W2_John.pdf',
      filename: '2025_W2_John.pdf',
    },
    {
      key: 'message-attachments/org_1/case_1/upload/private-photo.png',
      filename: 'private-photo.png',
    },
    {
      key: 'staff-files/org_1/staff_1/documents/file-uuid.pdf',
      filename: 'file-uuid.pdf',
    },
  ])('redacts storage path $key and URLs from storage error logs', async ({ key, filename }) => {
    mockGetSignedUrl.mockRejectedValueOnce(
      new Error(`failed for ${key} at https://signed.example.com/private.pdf?token=secret`)
    )

    await storage.getSignedDownloadUrl(key)

    const errors = serializedConsoleCalls(vi.mocked(console.error))

    expect(errors).not.toContain(key)
    expect(errors).not.toContain(filename)
    expect(errors).not.toContain('https://signed.example.com')
    expect(errors).toContain('[REDACTED_KEY]')
    expect(errors).toContain('[REDACTED_URL]')
  })

  it('generates staff personal document keys without original filenames', () => {
    const key = storage.generateStaffFileKey({
      organizationId: 'org_1',
      staffId: 'staff_1',
      kind: 'PERSONAL_DOCUMENT',
      filename: 'passport Fiona.pdf',
      contentType: 'application/pdf',
    })

    expect(key).toMatch(/^staff-files\/org_1\/staff_1\/documents\/[0-9a-f-]+\.pdf$/)
    expect(key).not.toContain('passport')
    expect(key).not.toContain('Fiona')
  })

  it('generates staff invoice keys with year-month folder', () => {
    const key = storage.generateStaffFileKey({
      organizationId: 'org_1',
      staffId: 'staff_1',
      kind: 'INVOICE',
      filename: 'June invoice.xlsx',
      invoiceYear: 2026,
      invoiceMonth: 6,
    })

    expect(key).toMatch(
      /^staff-files\/org_1\/staff_1\/invoices\/2026-06\/[0-9a-f-]+\.xlsx$/
    )
    expect(key).not.toContain('June invoice')
  })

  it('requires invoice metadata for staff invoice keys', () => {
    expect(() =>
      storage.generateStaffFileKey({
        organizationId: 'org_1',
        staffId: 'staff_1',
        kind: 'INVOICE',
        filename: 'invoice.pdf',
      })
    ).toThrow('invoiceYear and invoiceMonth are required')
  })
})
