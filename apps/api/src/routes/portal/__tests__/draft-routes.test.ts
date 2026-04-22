/**
 * Portal Draft Routes Tests (public /portal/draft/:token)
 * Covers title field, soft-deleted DOC_DELETED 410, legacy backfilled row,
 * revoked/expired link errors, view tracking.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    magicLink: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shareableDocument: {
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../../services/storage'
import { portalDraftRoute } from '../draft'

const mockMagicLinkFindUnique = vi.mocked(prisma.magicLink.findUnique)
const mockMagicLinkUpdate = vi.mocked(prisma.magicLink.update)
const mockDocUpdate = vi.mocked(prisma.shareableDocument.update)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)

const app = new Hono()
app.route('/portal/draft', portalDraftRoute)

function mockLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    token: 'tok-abc',
    type: 'DRAFT_RETURN',
    isActive: true,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    draftReturn: {
      id: 'doc-1',
      title: 'Tax Analysis',
      r2Key: 'cases/case-1/draft-returns/1.pdf',
      filename: 'return.pdf',
      version: 1,
      createdAt: new Date('2026-04-21T00:00:00Z'),
      deletedAt: null,
    },
    taxCase: {
      taxYear: 2025,
      client: { name: 'Jane Doe', language: 'en' },
    },
    ...overrides,
  }
}

describe('Portal Draft Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /portal/draft/:token', () => {
    it('returns title + clientName + pdfUrl on happy path', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(mockLink() as any)
      mockGetSignedUrl.mockResolvedValueOnce('https://cdn.test/signed')
      mockMagicLinkUpdate.mockResolvedValueOnce({} as any)

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.title).toBe('Tax Analysis')
      expect(json.clientName).toBe('Jane Doe')
      expect(json.clientLanguage).toBe('en')
      expect(json.taxYear).toBe(2025)
      expect(json.version).toBe(1)
      expect(json.filename).toBe('return.pdf')
      expect(json.uploadedAt).toBe('2026-04-21T00:00:00.000Z')
      expect(json.pdfUrl).toBe('https://cdn.test/signed')
      expect(mockMagicLinkUpdate).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { lastUsedAt: expect.any(Date), usageCount: { increment: 1 } },
      })
    })

    it('still works with legacy backfilled title "Draft Return"', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(
        mockLink({
          draftReturn: {
            id: 'doc-legacy',
            title: 'Draft Return',
            r2Key: 'cases/old/draft-returns/legacy.pdf',
            filename: 'legacy.pdf',
            version: 1,
            createdAt: new Date('2025-12-01'),
            deletedAt: null,
          },
        }) as any
      )
      mockGetSignedUrl.mockResolvedValueOnce('https://cdn.test/legacy')
      mockMagicLinkUpdate.mockResolvedValueOnce({} as any)

      const res = await app.request('/portal/draft/tok-legacy')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.title).toBe('Draft Return')
      expect(json.pdfUrl).toBe('https://cdn.test/legacy')
    })

    it('returns 410 DOC_DELETED when section soft-deleted', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(
        mockLink({
          draftReturn: {
            id: 'doc-1',
            title: 'Tax Analysis',
            r2Key: 'k',
            filename: 'f.pdf',
            version: 1,
            createdAt: new Date(),
            deletedAt: new Date('2026-04-22'),
          },
        }) as any
      )

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(410)
      expect(json.error).toBe('DOC_DELETED')
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it('returns 401 INVALID_TOKEN when token missing', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/portal/draft/missing')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('INVALID_TOKEN')
    })

    it('returns 401 INVALID_TOKEN_TYPE for non-draft magic link', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(mockLink({ type: 'UPLOAD' }) as any)

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('INVALID_TOKEN_TYPE')
    })

    it('returns 401 LINK_REVOKED when isActive=false', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(mockLink({ isActive: false }) as any)

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('LINK_REVOKED')
    })

    it('returns 401 LINK_EXPIRED when expiresAt in past', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(
        mockLink({ expiresAt: new Date('2020-01-01') }) as any
      )

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('LINK_EXPIRED')
    })

    it('returns 404 DRAFT_NOT_FOUND when link has no draftReturn', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(mockLink({ draftReturn: null }) as any)

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('DRAFT_NOT_FOUND')
    })

    it('returns 500 PDF_UNAVAILABLE when signed URL generation fails', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(mockLink() as any)
      mockGetSignedUrl.mockResolvedValueOnce(null as any)

      const res = await app.request('/portal/draft/tok-abc')
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('PDF_UNAVAILABLE')
    })
  })

  describe('POST /portal/draft/:token/viewed', () => {
    it('increments viewCount and sets lastViewedAt', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce({
        draftReturnId: 'doc-1',
        isActive: true,
      } as any)
      mockDocUpdate.mockResolvedValueOnce({} as any)

      const res = await app.request('/portal/draft/tok-abc/viewed', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockDocUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { viewCount: { increment: 1 }, lastViewedAt: expect.any(Date) },
      })
    })

    it('returns 400 when magic link inactive', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce({
        draftReturnId: 'doc-1',
        isActive: false,
      } as any)

      const res = await app.request('/portal/draft/tok-abc/viewed', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(mockDocUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 when token not found', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/portal/draft/missing/viewed', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
    })

    it('returns 400 when magic link has no draftReturnId', async () => {
      mockMagicLinkFindUnique.mockResolvedValueOnce({
        draftReturnId: null,
        isActive: true,
      } as any)

      const res = await app.request('/portal/draft/tok-abc/viewed', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(mockDocUpdate).not.toHaveBeenCalled()
    })
  })
})
