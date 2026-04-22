/**
 * Shared Docs Routes Tests
 * Covers CRUD (create/list/get/rename/delete), version upload, link revoke/extend,
 * org scoping, title validation, and soft-delete cascade semantics.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma — hoisted above imports by vitest transform
vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: { findFirst: vi.fn() },
    shareableDocument: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    magicLink: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock storage — avoid real R2/S3 calls
vi.mock('../../../services/storage', () => ({
  uploadFile: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}))

// Mock org-scope helper — return predictable where clause
vi.mock('../../../lib/org-scope', () => ({
  buildNestedClientScope: vi.fn(() => ({ client: { orgId: 'org-1' } })),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../../services/storage'
import { buildNestedClientScope } from '../../../lib/org-scope'
import { sharedDocsRoute } from '../index'
import { __resetDeprecationWarnedForTests } from '../link-handlers'

const mockTaxCaseFindFirst = vi.mocked(prisma.taxCase.findFirst)
const mockDocFindFirst = vi.mocked(prisma.shareableDocument.findFirst)
const mockDocFindMany = vi.mocked(prisma.shareableDocument.findMany)
const mockDocFindUniqueOrThrow = vi.mocked(prisma.shareableDocument.findUniqueOrThrow)
const mockDocUpdateMany = vi.mocked(prisma.shareableDocument.updateMany)
const mockMagicLinkFindFirst = vi.mocked(prisma.magicLink.findFirst)
const mockMagicLinkCreate = vi.mocked(prisma.magicLink.create)
const mockMagicLinkUpdateMany = vi.mocked(prisma.magicLink.updateMany)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockDocUpdate = vi.mocked(prisma.shareableDocument.update)
const mockUploadFile = vi.mocked(uploadFile)
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl)
const mockBuildScope = vi.mocked(buildNestedClientScope)

const ORG_SCOPE = { client: { orgId: 'org-1' } }

// Mount with mock auth middleware that injects staffId for all tests
const app = new Hono()
app.use('*', async (c, next) => {
  c.set('user' as any, { staffId: 'staff-1', orgId: 'org-1' })
  await next()
})
app.route('/shared-docs', sharedDocsRoute)

// Valid minimal PDF (magic header + trailer) ≥ 4 bytes starting with %PDF
const PDF_BYTES = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('1 0 obj<<>>endobj\n'),
  Buffer.from('%%EOF'),
])

function makeFormData(title: string | null, fileBuffer: Buffer | null, fileType = 'application/pdf', filename = 'return.pdf') {
  const form = new FormData()
  if (title !== null) form.append('title', title)
  if (fileBuffer) {
    const blob = new Blob([fileBuffer], { type: fileType })
    form.append('file', blob, filename)
  }
  return form
}

function mockDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    taxCaseId: 'case-1',
    title: 'Section Title',
    r2Key: 'cases/case-1/draft-returns/123.pdf',
    filename: 'return.pdf',
    fileSize: 100,
    version: 1,
    status: 'ACTIVE',
    deletedAt: null,
    viewCount: 0,
    lastViewedAt: null,
    createdAt: new Date('2026-04-21T00:00:00Z'),
    uploadedBy: { id: 'staff-1', name: 'CPA User' },
    ...overrides,
  }
}

function mockMagicLink(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    token: 'tok-abc',
    isActive: true,
    expiresAt: new Date('2026-05-05T00:00:00Z'),
    usageCount: 0,
    lastUsedAt: null,
    ...overrides,
  }
}

describe('Shared Docs Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /shared-docs/:caseId (create section)', () => {
    it('creates section with valid title and PDF file', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      // no title conflict
      mockDocFindFirst.mockResolvedValueOnce(null)
      mockTransaction.mockImplementationOnce(async (fn: any) => {
        return fn({
          shareableDocument: {
            create: vi.fn().mockResolvedValue(mockDoc({ title: 'Tax Analysis' })),
          },
          magicLink: {
            create: vi.fn().mockResolvedValue(mockMagicLink()),
          },
        })
      })
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('Tax Analysis', PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.document.title).toBe('Tax Analysis')
      expect(json.magicLink.token).toBe('tok-abc')
      expect(json.portalUrl).toContain('/draft/tok-abc')
      expect(mockUploadFile).toHaveBeenCalledTimes(1)
    })

    it('rejects empty title (INVALID_TITLE)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('   ', PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_TITLE')
    })

    it('rejects title > 100 chars (INVALID_TITLE)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('x'.repeat(101), PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_TITLE')
    })

    it('rejects duplicate active title within same case (DUPLICATE_TITLE)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-existing' } as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('Draft Return', PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('DUPLICATE_TITLE')
    })

    it('rejects non-PDF content type (INVALID_TYPE)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('Draft Return', Buffer.from('plain text'), 'text/plain', 'not.txt'),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_TYPE')
    })

    it('rejects buffer without PDF magic bytes (INVALID_PDF)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('Draft Return', Buffer.from('NOT-A-PDF-HEADER')),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_PDF')
    })

    it('returns 404 when case not found (cross-org scoping)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/bad-case', {
        method: 'POST',
        body: makeFormData('Draft Return', PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('CASE_NOT_FOUND')
    })

    it('accepts title at exact 100-char boundary', async () => {
      const title100 = 'x'.repeat(100)
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          shareableDocument: { create: vi.fn().mockResolvedValue(mockDoc({ title: title100 })) },
          magicLink: { create: vi.fn().mockResolvedValue(mockMagicLink()) },
        })
      )
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData(title100, PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.document.title).toHaveLength(100)
    })

    it('accepts single-character title (min boundary)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          shareableDocument: { create: vi.fn().mockResolvedValue(mockDoc({ title: 'Q' })) },
          magicLink: { create: vi.fn().mockResolvedValue(mockMagicLink()) },
        })
      )
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData('Q', PDF_BYTES),
      })

      expect(res.status).toBe(200)
    })

    it('stores titles with SQL/shell meta-chars safely (injection guard)', async () => {
      const hostileTitle = `Robert'); DROP TABLE shared_docs;--`
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)
      const docCreate = vi.fn().mockResolvedValue(mockDoc({ title: hostileTitle }))
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          shareableDocument: { create: docCreate },
          magicLink: { create: vi.fn().mockResolvedValue(mockMagicLink()) },
        })
      )
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/case-1', {
        method: 'POST',
        body: makeFormData(hostileTitle, PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      // Prisma parameterization: title stored as literal, not interpolated into SQL
      expect(docCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: hostileTitle }) })
      )
      expect(json.document.title).toBe(hostileTitle)
    })
  })

  describe('GET /shared-docs/case/:caseId (list sections)', () => {
    it('returns only non-deleted ACTIVE sections with their latest magic link', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindMany.mockResolvedValueOnce([
        { ...mockDoc({ id: 'doc-a', title: 'Section A' }), magicLinks: [mockMagicLink({ token: 'tok-a' })] },
        { ...mockDoc({ id: 'doc-b', title: 'Section B' }), magicLinks: [] },
      ] as any)

      const res = await app.request('/shared-docs/case/case-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.documents).toHaveLength(2)
      expect(json.documents[0].title).toBe('Section A')
      expect(json.documents[0].magicLink.token).toBe('tok-a')
      expect(json.documents[1].magicLink).toBeNull()
      // Verify where clause excludes deletedAt + restricts to ACTIVE
      const call = mockDocFindMany.mock.calls[0][0] as any
      expect(call.where.deletedAt).toBeNull()
      expect(call.where.status).toBe('ACTIVE')
    })

    it('enforces org scope on case lookup (security-critical)', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce({ id: 'case-1' } as any)
      mockDocFindMany.mockResolvedValueOnce([])

      await app.request('/shared-docs/case/case-1')

      const where = mockTaxCaseFindFirst.mock.calls[0][0]?.where as any
      expect(where).toMatchObject({ id: 'case-1', ...ORG_SCOPE })
      expect(mockBuildScope).toHaveBeenCalled()
    })

    it('returns 404 when case not in caller org', async () => {
      mockTaxCaseFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/case/other-org-case')
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('CASE_NOT_FOUND')
    })
  })

  describe('PATCH /shared-docs/:id (rename)', () => {
    it('renames section and propagates title to all versions', async () => {
      mockDocFindFirst
        .mockResolvedValueOnce(mockDoc({ title: 'Old Title' }) as any) // existing lookup
        .mockResolvedValueOnce(null) // title-unique check
      mockDocUpdateMany.mockResolvedValueOnce({ count: 2 } as any)
      mockDocFindUniqueOrThrow.mockResolvedValueOnce(mockDoc({ title: 'New Title' }) as any)

      const res = await app.request('/shared-docs/doc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.document.title).toBe('New Title')
      expect(mockDocUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ taxCaseId: 'case-1', title: 'Old Title' }),
          data: { title: 'New Title' },
        })
      )
    })

    it('rejects blank title on rename (INVALID_TITLE)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(mockDoc() as any)

      const res = await app.request('/shared-docs/doc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_TITLE')
      expect(mockDocUpdateMany).not.toHaveBeenCalled()
    })

    it('skips update when title unchanged (idempotent noop)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(mockDoc({ title: 'Same' }) as any)
      mockDocFindUniqueOrThrow.mockResolvedValueOnce(mockDoc({ title: 'Same' }) as any)

      const res = await app.request('/shared-docs/doc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Same' }),
      })

      expect(res.status).toBe(200)
      expect(mockDocUpdateMany).not.toHaveBeenCalled()
    })

    it('returns 404 when section not found or not in org', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/missing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Anything' }),
      })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('NOT_FOUND')
    })
  })

  describe('DELETE /shared-docs/:id (soft delete cascade)', () => {
    it('sets deletedAt and deactivates magic links in a transaction', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', deletedAt: null } as any)
      mockDocUpdate.mockReturnValueOnce({ __kind: 'update' } as any)
      mockMagicLinkUpdateMany.mockReturnValueOnce({ __kind: 'updateMany' } as any)
      mockTransaction.mockResolvedValueOnce([{ id: 'doc-1' }, { count: 1 }] as any)

      const res = await app.request('/shared-docs/doc-1', { method: 'DELETE' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      // Verify both statements were built with correct where+data BEFORE being passed to $transaction
      expect(mockDocUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { deletedAt: expect.any(Date) },
      })
      expect(mockMagicLinkUpdateMany).toHaveBeenCalledWith({
        where: { draftReturnId: 'doc-1', isActive: true },
        data: { isActive: false },
      })
      // And both statements reached $transaction as a 2-element array
      const txArg = mockTransaction.mock.calls[0][0] as any[]
      expect(Array.isArray(txArg)).toBe(true)
      expect(txArg).toHaveLength(2)
    })

    it('is idempotent when already soft-deleted', async () => {
      mockDocFindFirst.mockResolvedValueOnce({
        id: 'doc-1',
        deletedAt: new Date('2026-04-20'),
      } as any)

      const res = await app.request('/shared-docs/doc-1', { method: 'DELETE' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it('returns 404 when section not found', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/missing', { method: 'DELETE' })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('NOT_FOUND')
    })
  })

  describe('POST /shared-docs/:id/version (upload version)', () => {
    it('creates v2, supersedes v1, reuses existing magic link token', async () => {
      mockDocFindFirst.mockResolvedValueOnce({
        id: 'doc-1',
        taxCaseId: 'case-1',
        title: 'Draft Return',
        version: 1,
      } as any)
      const txDocUpdate = vi.fn().mockResolvedValue({ id: 'doc-1' })
      const txDocCreate = vi.fn().mockResolvedValue(mockDoc({ id: 'doc-2', version: 2 }))
      const txLinkFindFirst = vi.fn().mockResolvedValue({ id: 'link-1' })
      const txLinkUpdate = vi.fn().mockResolvedValue(mockMagicLink({ token: 'tok-abc' }))
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          shareableDocument: { update: txDocUpdate, create: txDocCreate },
          magicLink: { findFirst: txLinkFindFirst, update: txLinkUpdate, create: vi.fn() },
        })
      )
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/doc-1/version', {
        method: 'POST',
        body: makeFormData(null, PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.document.version).toBe(2)
      expect(json.magicLink.token).toBe('tok-abc')
      expect(txDocUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: 'SUPERSEDED' },
      })
      expect(txLinkUpdate).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when current ACTIVE version not found', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/doc-1/version', {
        method: 'POST',
        body: makeFormData(null, PDF_BYTES),
      })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('NOT_FOUND')
    })

    it('supersedes only the targeted section (sibling isolation)', async () => {
      // Current section: doc-1. Sibling: doc-sibling (must NOT be touched).
      mockDocFindFirst.mockResolvedValueOnce({
        id: 'doc-1',
        taxCaseId: 'case-1',
        title: 'Draft Return',
        version: 1,
      } as any)
      const txDocUpdate = vi.fn().mockResolvedValue({ id: 'doc-1' })
      const txDocCreate = vi.fn().mockResolvedValue(mockDoc({ id: 'doc-2', version: 2 }))
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          shareableDocument: { update: txDocUpdate, create: txDocCreate },
          magicLink: {
            findFirst: vi.fn().mockResolvedValue({ id: 'link-1' }),
            update: vi.fn().mockResolvedValue(mockMagicLink()),
            create: vi.fn(),
          },
        })
      )
      mockUploadFile.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/shared-docs/doc-1/version', {
        method: 'POST',
        body: makeFormData(null, PDF_BYTES),
      })

      expect(res.status).toBe(200)
      // Supersede targets current doc id ONLY — not an updateMany across siblings
      expect(txDocUpdate).toHaveBeenCalledTimes(1)
      expect(txDocUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: 'SUPERSEDED' },
      })
      // No updateMany should be invoked (that would risk blast radius)
      expect(mockDocUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('POST /shared-docs/:id/pause', () => {
    it('deactivates active magic link (idempotent)', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      mockMagicLinkUpdateMany.mockResolvedValueOnce({ count: 1 } as any)

      const res = await app.request('/shared-docs/doc-1/pause', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockMagicLinkUpdateMany).toHaveBeenCalledWith({
        where: { draftReturnId: 'doc-1', isActive: true },
        data: { isActive: false },
      })
    })

    it('succeeds idempotently when no active link exists (count=0)', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      mockMagicLinkUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      const res = await app.request('/shared-docs/doc-1/pause', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
    })

    it('returns 404 when section not in caller org (authz)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/foreign/pause', { method: 'POST' })
      expect(res.status).toBe(404)
      expect(mockMagicLinkUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('POST /shared-docs/:id/revoke (deprecated alias for /pause)', () => {
    beforeEach(() => {
      // Reset once-per-process deprecation flag so this describe block
      // is not order-dependent on prior test file execution.
      __resetDeprecationWarnedForTests()
    })

    it('behaves like /pause AND emits deprecation warning exactly once per process', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockDocFindFirst.mockResolvedValue({ id: 'doc-1' } as any)
      mockMagicLinkUpdateMany.mockResolvedValue({ count: 1 } as any)

      const res1 = await app.request('/shared-docs/doc-1/revoke', { method: 'POST' })
      const res2 = await app.request('/shared-docs/doc-1/revoke', { method: 'POST' })

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      // Both calls hit updateMany with pause-equivalent args
      expect(mockMagicLinkUpdateMany).toHaveBeenCalledWith({
        where: { draftReturnId: 'doc-1', isActive: true },
        data: { isActive: false },
      })
      expect(mockMagicLinkUpdateMany).toHaveBeenCalledTimes(2)
      // Deprecation warning emitted ONCE across both calls (once-per-process)
      const deprecationCalls = warnSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('DEPRECATED')
      )
      expect(deprecationCalls).toHaveLength(1)
      expect(deprecationCalls[0][0]).toMatch(/\/revoke/)
      expect(deprecationCalls[0][0]).toMatch(/\/pause/)
    })

    it('returns 404 when section not in caller org (authz)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/foreign/revoke', { method: 'POST' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /shared-docs/:id/resume', () => {
    function setResumeTx(link: any | null) {
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          magicLink: {
            findFirst: vi.fn().mockResolvedValue(link ? { id: 'link-1' } : null),
            update: vi.fn().mockResolvedValue(link),
          },
        })
      )
    }

    it('reactivates paused link with fresh 14d expiry and preserves token', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      setResumeTx(mockMagicLink({ isActive: true, token: 'tok-abc' }))

      const before = Date.now()
      const res = await app.request('/shared-docs/doc-1/resume', { method: 'POST' })
      const after = Date.now()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.magicLink.token).toBe('tok-abc')
      // expiresAt ≈ now + 14 days (tolerance: the two Date.now() snapshots)
      const returned = new Date(json.expiresAt).getTime()
      const minExpected = before + 14 * 24 * 60 * 60 * 1000
      const maxExpected = after + 14 * 24 * 60 * 60 * 1000
      expect(returned).toBeGreaterThanOrEqual(minExpected)
      expect(returned).toBeLessThanOrEqual(maxExpected)
    })

    it('returns 404 LINK_NOT_FOUND when section never had a link', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      setResumeTx(null)

      const res = await app.request('/shared-docs/doc-1/resume', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('LINK_NOT_FOUND')
    })

    it('returns 404 when section not in caller org (authz)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/foreign/resume', { method: 'POST' })
      expect(res.status).toBe(404)
      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })

  describe('POST /shared-docs/:id/extend (duration param)', () => {
    // Capture the data arg to tx.magicLink.update so we can assert expiresAt
    function setExtendTx(capture: { data?: any }) {
      mockTransaction.mockImplementationOnce(async (fn: any) => {
        const update = vi.fn().mockImplementation(({ data }: any) => {
          capture.data = data
          return Promise.resolve(mockMagicLink({ expiresAt: data.expiresAt }))
        })
        return fn({
          magicLink: {
            findFirst: vi.fn().mockResolvedValue({ id: 'link-1' }),
            update,
          },
        })
      })
    }

    function msFromNow(days: number) {
      return Date.now() + days * 24 * 60 * 60 * 1000
    }

    async function extend(body?: unknown) {
      return app.request('/shared-docs/doc-1/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }

    it.each([
      ['7d', 7],
      ['14d', 14],
      ['30d', 30],
    ])('applies %s duration (expiresAt ≈ now + %s days)', async (duration, days) => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      const cap: { data?: any } = {}
      setExtendTx(cap)

      const before = msFromNow(days)
      const res = await extend({ duration })
      const after = msFromNow(days)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      // Persisted expiresAt is a Date within tolerance window
      expect(cap.data.expiresAt).toBeInstanceOf(Date)
      const persisted = (cap.data.expiresAt as Date).getTime()
      expect(persisted).toBeGreaterThanOrEqual(before)
      expect(persisted).toBeLessThanOrEqual(after)
    })

    it('defaults to 14d when body omitted', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      const cap: { data?: any } = {}
      setExtendTx(cap)

      const before = msFromNow(14)
      const res = await extend() // no body → default 14d
      const after = msFromNow(14)
      expect(res.status).toBe(200)
      const persisted = (cap.data.expiresAt as Date).getTime()
      expect(persisted).toBeGreaterThanOrEqual(before)
      expect(persisted).toBeLessThanOrEqual(after)
    })

    it('applies never duration (persists expiresAt=null)', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      const cap: { data?: any } = {}
      setExtendTx(cap)

      const res = await extend({ duration: 'never' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.expiresAt).toBeNull()
      expect(cap.data.expiresAt).toBeNull()
    })

    it('rejects invalid duration with 400 INVALID_DURATION (no DB write)', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)

      const res = await extend({ duration: '90d' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_DURATION')
      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it('returns 400 NO_ACTIVE_LINK when no active link exists', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          magicLink: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        })
      )

      const res = await extend({ duration: '7d' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NO_ACTIVE_LINK')
    })

    it('returns 404 when section not in caller org (authz)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await extend({ duration: '7d' })
      expect(res.status).toBe(404)
      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })

  describe('POST /shared-docs/:id/generate-link', () => {
    it('creates magic link when section has none', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', taxCaseId: 'case-1' } as any)
      mockMagicLinkFindFirst.mockResolvedValueOnce(null) // no existing link
      mockMagicLinkCreate.mockResolvedValueOnce(mockMagicLink({ token: 'tok-new' }) as any)

      const res = await app.request('/shared-docs/doc-1/generate-link', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.magicLink.token).toBe('tok-new')
      // Create called with draft-return type + section binding + active flag
      expect(mockMagicLinkCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: 'case-1',
            type: 'DRAFT_RETURN',
            draftReturnId: 'doc-1',
            isActive: true,
            expiresAt: expect.any(Date),
          }),
        })
      )
    })

    it('returns 400 LINK_EXISTS when any link (active or paused) already exists', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1', taxCaseId: 'case-1' } as any)
      mockMagicLinkFindFirst.mockResolvedValueOnce({ id: 'link-1' } as any)

      const res = await app.request('/shared-docs/doc-1/generate-link', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('LINK_EXISTS')
      expect(mockMagicLinkCreate).not.toHaveBeenCalled()
    })

    it('returns 404 when section not in caller org (authz)', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/foreign/generate-link', { method: 'POST' })
      expect(res.status).toBe(404)
      expect(mockMagicLinkCreate).not.toHaveBeenCalled()
    })
  })

  describe('Pause → Resume → Extend lifecycle (token preservation)', () => {
    it('preserves magic link token across full cycle and applies fresh 30d on extend', async () => {
      // PAUSE
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      mockMagicLinkUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      const pauseRes = await app.request('/shared-docs/doc-1/pause', { method: 'POST' })
      expect(pauseRes.status).toBe(200)
      expect(mockMagicLinkUpdateMany).toHaveBeenLastCalledWith({
        where: { draftReturnId: 'doc-1', isActive: true },
        data: { isActive: false },
      })

      // RESUME — capture update data to prove handler does NOT rotate token
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      const resumeCapture: { data?: any } = {}
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          magicLink: {
            findFirst: vi.fn().mockResolvedValue({ id: 'link-1' }),
            update: vi.fn().mockImplementation(({ data }: any) => {
              resumeCapture.data = data
              return Promise.resolve(mockMagicLink({ token: 'tok-abc', isActive: true }))
            }),
          },
        })
      )
      const resumeRes = await app.request('/shared-docs/doc-1/resume', { method: 'POST' })
      expect(resumeRes.status).toBe(200)
      // Handler never writes `token` — only flips isActive + refreshes expiresAt.
      expect(resumeCapture.data).not.toHaveProperty('token')
      expect(resumeCapture.data.isActive).toBe(true)
      expect(resumeCapture.data.expiresAt).toBeInstanceOf(Date)

      // EXTEND(30d) — same link id, expiresAt bumped to +30d, token must not be written
      mockDocFindFirst.mockResolvedValueOnce({ id: 'doc-1' } as any)
      const capturedData: { data?: any } = {}
      mockTransaction.mockImplementationOnce(async (fn: any) =>
        fn({
          magicLink: {
            findFirst: vi.fn().mockResolvedValue({ id: 'link-1' }),
            update: vi.fn().mockImplementation(({ data }: any) => {
              capturedData.data = data
              return Promise.resolve(mockMagicLink({ token: 'tok-abc', expiresAt: data.expiresAt }))
            }),
          },
        })
      )
      const before30 = Date.now() + 30 * 24 * 60 * 60 * 1000
      const extendRes = await app.request('/shared-docs/doc-1/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: '30d' }),
      })
      const after30 = Date.now() + 30 * 24 * 60 * 60 * 1000
      expect(extendRes.status).toBe(200)
      expect(capturedData.data).not.toHaveProperty('token')
      const persisted = (capturedData.data.expiresAt as Date).getTime()
      expect(persisted).toBeGreaterThanOrEqual(before30)
      expect(persisted).toBeLessThanOrEqual(after30)
    })
  })

  describe('GET /shared-docs/:id/signed-url', () => {
    it('returns signed URL for section current version', async () => {
      mockDocFindFirst.mockResolvedValueOnce({
        r2Key: 'cases/case-1/draft-returns/1.pdf',
        filename: 'return.pdf',
      } as any)
      mockGetSignedUrl.mockResolvedValueOnce('https://cdn.test/signed?token=xyz')

      const res = await app.request('/shared-docs/doc-1/signed-url')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.url).toBe('https://cdn.test/signed?token=xyz')
      expect(json.filename).toBe('return.pdf')
    })

    it('returns 404 when section not in org', async () => {
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/foreign/signed-url')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /shared-docs/:id/version/:version/signed-url', () => {
    it('returns signed URL for specific prior version in same section', async () => {
      // anchor lookup
      mockDocFindFirst.mockResolvedValueOnce({ taxCaseId: 'case-1', title: 'Draft Return' } as any)
      // version lookup
      mockDocFindFirst.mockResolvedValueOnce({
        r2Key: 'cases/case-1/draft-returns/1.pdf',
        filename: 'return-v1.pdf',
      } as any)
      mockGetSignedUrl.mockResolvedValueOnce('https://cdn.test/signed-v1')

      const res = await app.request('/shared-docs/doc-2/version/1/signed-url')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.url).toBe('https://cdn.test/signed-v1')
      expect(json.filename).toBe('return-v1.pdf')
    })

    it('returns 400 for invalid version number', async () => {
      const res = await app.request('/shared-docs/doc-1/version/abc/signed-url')
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('INVALID_VERSION')
    })

    it('returns 404 when version not found', async () => {
      mockDocFindFirst.mockResolvedValueOnce({ taxCaseId: 'case-1', title: 'Draft Return' } as any)
      mockDocFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/shared-docs/doc-1/version/99/signed-url')
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('VERSION_NOT_FOUND')
    })
  })

  describe('GET /shared-docs/:id (get section detail)', () => {
    it('returns section + magic link + version history', async () => {
      mockDocFindFirst.mockResolvedValueOnce(mockDoc() as any)
      mockMagicLinkFindFirst.mockResolvedValueOnce(mockMagicLink() as any)
      mockDocFindMany.mockResolvedValueOnce([
        { version: 2, createdAt: new Date('2026-04-22'), status: 'ACTIVE' },
        { version: 1, createdAt: new Date('2026-04-21'), status: 'SUPERSEDED' },
      ] as any)

      const res = await app.request('/shared-docs/doc-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.document.id).toBe('doc-1')
      expect(json.magicLink.token).toBe('tok-abc')
      expect(json.versions).toHaveLength(2)
      expect(json.versions[0].version).toBe(2)
    })

    it('returns null magicLink when no link exists', async () => {
      mockDocFindFirst.mockResolvedValueOnce(mockDoc() as any)
      mockMagicLinkFindFirst.mockResolvedValueOnce(null)
      mockDocFindMany.mockResolvedValueOnce([
        { version: 1, createdAt: new Date('2026-04-21'), status: 'ACTIVE' },
      ] as any)

      const res = await app.request('/shared-docs/doc-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.magicLink).toBeNull()
    })
  })
})
