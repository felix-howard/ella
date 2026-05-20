/**
 * Storage Rename Function Tests
 * Tests R2 copy-only pattern for file renaming.
 * Callers delete the old key after DB update succeeds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let mockSend: ReturnType<typeof vi.fn>

// Mock AWS S3 client before imports
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

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

// Set env vars before importing storage
const mockEnv = {
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  R2_BUCKET_NAME: 'test-bucket',
}

Object.assign(process.env, mockEnv)

// Dynamic import to pick up mocked env
const { renameFile } = await import('../storage')

describe('Storage Rename', () => {
  beforeEach(() => {
    mockSend.mockClear()

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('renameFile', () => {
    it('should copy file to new key', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: 'Google LLC',
          recipientName: 'John Smith',
        }
      )

      expect(result.success).toBe(true)
      expect(result.newKey).toBe('cases/abc123/docs/2025_W2_GoogleLlc_JohnSmith.pdf')
      expect(result.oldKey).toBe('cases/abc123/raw/123456.pdf')
    })

    it('should preserve file extension', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/photo.jpg',
        'abc123',
        {
          taxYear: 2025,
          docType: 'DRIVER_LICENSE',
          source: null,
          recipientName: 'John',
        }
      )

      expect(result.newKey).toMatch(/\.jpg$/)
    })

    it('should skip rename when keys are identical', async () => {
      const result = await renameFile(
        'cases/abc123/docs/2025_W2_Google_John.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: 'Google',
          recipientName: 'John',
        }
      )

      expect(result.success).toBe(true)
      expect(result.newKey).toBe(result.oldKey)
      // Should not have called S3
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should handle copy failure gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('Copy failed'))

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: 'Google',
          recipientName: 'John',
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Copy failed')
      // Keep old key on failure
      expect(result.newKey).toBe('cases/abc123/raw/123456.pdf')
    })

    it('should leave old key deletion to the caller', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: null,
          recipientName: 'John',
        }
      )

      expect(result.success).toBe(true)
      expect(result.newKey).toBe('cases/abc123/docs/2025_W2_John.pdf')
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should handle Vietnamese names correctly', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: 'Công ty ABC',
          recipientName: 'Nguyễn Văn A',
        }
      )

      expect(result.newKey).toBe('cases/abc123/docs/2025_W2_CongTyAbc_NguyenVanA.pdf')
    })

    it('should omit year for identity docs even when taxYear is null', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: null,
          docType: 'SSN_CARD',
          source: null,
          recipientName: 'John',
        }
      )

      expect(result.newKey).toBe('cases/abc123/docs/SSN_CARD_John.pdf')
    })

    it('should default to pdf extension when none found', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/noextension',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: null,
          recipientName: 'John',
        }
      )

      expect(result.newKey).toMatch(/\.pdf$/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty source', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'PASSPORT',
          source: '',
          recipientName: 'John',
        }
      )

      expect(result.newKey).toBe('cases/abc123/docs/PASSPORT_John.pdf')
    })

    it('should handle complex doc types', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'SCHEDULE_K1_1065',
          source: 'Partnership Inc',
          recipientName: 'John',
        }
      )

      expect(result.newKey).toContain('SCHEDULE_K1_1065')
    })
  })
})
