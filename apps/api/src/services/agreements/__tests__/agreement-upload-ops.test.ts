/**
 * Unit tests for staff PDF-upload validation + key scoping. Storage is mocked;
 * pdf-lib parsing runs for real against pdf-lib-generated fixtures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PDFDocument } from 'pdf-lib'

vi.mock('../../storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ key: 'k', url: null }),
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.test/preview'),
}))

import { uploadFile } from '../../storage'
import {
  storeUploadedPdf,
  assertValidUploadedPdfKey,
  buildUploadedPdfKey,
  UPLOADED_PDF_KEY_PREFIX,
} from '../agreement-upload-ops'

async function validPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.addPage([612, 792])
  return Buffer.from(await doc.save())
}

const baseInput = { entityType: 'client' as const, entityId: 'client_1', orgId: 'org_1' }

describe('storeUploadedPdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a valid PDF and returns key + pageCount + previewUrl', async () => {
    const res = await storeUploadedPdf({ ...baseInput, bytes: await validPdf(), contentType: 'application/pdf' })
    expect(res.key.startsWith(`${UPLOADED_PDF_KEY_PREFIX}client_1/`)).toBe(true)
    expect(res.key.endsWith('.pdf')).toBe(true)
    expect(res.pageCount).toBe(1)
    expect(res.previewUrl).toBe('https://r2.test/preview')
    expect(uploadFile).toHaveBeenCalledOnce()
  })

  it('rejects an empty file', async () => {
    await expect(
      storeUploadedPdf({ ...baseInput, bytes: Buffer.alloc(0), contentType: 'application/pdf' }),
    ).rejects.toMatchObject({ status: 422 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects a non-PDF (bad magic bytes)', async () => {
    await expect(
      storeUploadedPdf({ ...baseInput, bytes: Buffer.from('GIF89a....'), contentType: 'application/pdf' }),
    ).rejects.toMatchObject({ status: 422 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const huge = Buffer.alloc(16 * 1024 * 1024)
    huge[0] = 0x25 // %
    huge[1] = 0x50 // P
    huge[2] = 0x44 // D
    huge[3] = 0x46 // F
    await expect(
      storeUploadedPdf({ ...baseInput, bytes: huge, contentType: 'application/pdf' }),
    ).rejects.toMatchObject({ status: 413 })
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects PDF-magic bytes that are not a parseable PDF', async () => {
    await expect(
      storeUploadedPdf({ ...baseInput, bytes: Buffer.from('%PDF-broken'), contentType: 'application/pdf' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('assertValidUploadedPdfKey', () => {
  it('accepts a key built by buildUploadedPdfKey for the same entity', () => {
    const key = buildUploadedPdfKey('client_1')
    expect(() => assertValidUploadedPdfKey(key, 'client_1')).not.toThrow()
  })

  it('rejects a key scoped to a different entity', () => {
    const key = buildUploadedPdfKey('client_1')
    expect(() => assertValidUploadedPdfKey(key, 'client_2')).toThrow()
  })

  it('rejects an arbitrary key outside the uploads prefix', () => {
    expect(() => assertValidUploadedPdfKey('agreements/firm-sigs/x.pdf', 'client_1')).toThrow()
    expect(() => assertValidUploadedPdfKey('cases/client_1/secret.pdf', 'client_1')).toThrow()
  })

  it('rejects a non-pdf extension', () => {
    expect(() =>
      assertValidUploadedPdfKey(`${UPLOADED_PDF_KEY_PREFIX}client_1/x.png`, 'client_1'),
    ).toThrow()
  })
})
