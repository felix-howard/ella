/**
 * Storage Rename Function Tests
 * Tests R2 copy+delete pattern for file renaming
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
    it('should copy file to new key and delete old key', async () => {
      mockSend.mockResolvedValue({})

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: 'Google LLC',
          clientName: 'John Smith',
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
          clientName: 'John',
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
          clientName: 'John',
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
          clientName: 'John',
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Copy failed')
      // Keep old key on failure
      expect(result.newKey).toBe('cases/abc123/raw/123456.pdf')
    })

    it('should succeed even if delete fails (orphaned file OK)', async () => {
      // First call (copy) succeeds, second call (delete) fails
      mockSend
        .mockResolvedValueOnce({}) // CopyObject
        .mockRejectedValueOnce(new Error('Delete failed')) // DeleteObject

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: 2025,
          docType: 'W2',
          source: null,
          clientName: 'John',
        }
      )

      // Should still succeed
      expect(result.success).toBe(true)
      expect(result.newKey).toBe('cases/abc123/docs/2025_W2_John.pdf')
      // Warning should be logged
      expect(console.warn).toHaveBeenCalled()
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
          clientName: 'Nguyễn Văn A',
        }
      )

      expect(result.newKey).toBe('cases/abc123/docs/2025_W2_CongTyAbc_NguyenVanA.pdf')
    })

    it('should use current year when taxYear is null', async () => {
      mockSend.mockResolvedValue({})
      const currentYear = new Date().getFullYear()

      const result = await renameFile(
        'cases/abc123/raw/123456.pdf',
        'abc123',
        {
          taxYear: null,
          docType: 'SSN_CARD',
          source: null,
          clientName: 'John',
        }
      )

      expect(result.newKey).toContain(String(currentYear))
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
          clientName: 'John',
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
          clientName: 'John',
        }
      )

      expect(result.newKey).toBe('cases/abc123/docs/2025_PASSPORT_John.pdf')
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
          clientName: 'John',
        }
      )

      expect(result.newKey).toContain('SCHEDULE_K1_1065')
    })
  })
})
