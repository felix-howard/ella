/**
 * PDF Converter Unit Tests
 * Tests for PDF to PNG conversion service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  convertPdfToImages,
  getPdfErrorMessage,
  isPdfMimeType,
  type PdfErrorType,
} from '../pdf-converter'

// Mock pdf-poppler module
vi.mock('pdf-poppler', () => ({
  info: vi.fn(),
  convert: vi.fn(),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
}))

// Get mocks
import * as pdf from 'pdf-poppler'
import * as fs from 'fs/promises'
const mockPdfInfo = vi.mocked(pdf.info)
const mockPdfConvert = vi.mocked(pdf.convert)
const mockFsReadFile = vi.mocked(fs.readFile)

// Test PDF buffer (valid PDF magic bytes %PDF)
function createValidPdfBuffer(): Buffer {
  const header = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
  const content = Buffer.from('-1.4 some content')
  return Buffer.concat([header, content])
}

// Invalid buffer (not a PDF)
function createInvalidBuffer(): Buffer {
  return Buffer.from('not a pdf file')
}

// Mock PNG buffer - cast to satisfy fs.readFile return type
function createMockPngBuffer(): Buffer<ArrayBuffer> {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) as Buffer<ArrayBuffer> // PNG magic
}

describe('convertPdfToImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('converts single page PDF successfully', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
    mockPdfConvert.mockResolvedValueOnce(undefined)
    mockFsReadFile.mockResolvedValueOnce(createMockPngBuffer())

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(true)
    expect(result.pages).toHaveLength(1)
    expect(result.pages![0].pageNumber).toBe(1)
    expect(result.pages![0].mimeType).toBe('image/png')
    expect(result.totalPages).toBe(1)
    expect(result.processingTimeMs).toBeDefined()
  })

  it('converts multi-page PDF successfully', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 3 })
    mockPdfConvert.mockResolvedValueOnce(undefined)
    mockFsReadFile
      .mockResolvedValueOnce(createMockPngBuffer())
      .mockResolvedValueOnce(createMockPngBuffer())
      .mockResolvedValueOnce(createMockPngBuffer())

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(true)
    expect(result.pages).toHaveLength(3)
    expect(result.totalPages).toBe(3)
    expect(result.pages![0].pageNumber).toBe(1)
    expect(result.pages![1].pageNumber).toBe(2)
    expect(result.pages![2].pageNumber).toBe(3)
  })

  it('rejects invalid PDF (wrong magic bytes)', async () => {
    const result = await convertPdfToImages(createInvalidBuffer())

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('INVALID_PDF')
    expect(result.error).toContain('không hợp lệ')
    // Should not call pdf-poppler for invalid PDFs
    expect(mockPdfInfo).not.toHaveBeenCalled()
  })

  it('rejects oversized PDF', async () => {
    // Create buffer larger than 20MB limit
    const largeBuffer = Buffer.concat([
      createValidPdfBuffer(),
      Buffer.alloc(21 * 1024 * 1024), // 21MB filler
    ])

    const result = await convertPdfToImages(largeBuffer)

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('TOO_LARGE')
    expect(result.error).toContain('20MB')
  })

  it('rejects PDF with too many pages', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 15 })

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('TOO_MANY_PAGES')
    expect(result.totalPages).toBe(15)
    expect(result.error).toContain('10')
  })

  it('handles encrypted PDF error', async () => {
    mockPdfInfo.mockRejectedValueOnce(new Error('Encrypted PDF requires password'))

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('ENCRYPTED_PDF')
    expect(result.error).toContain('mật khẩu')
  })

  it('handles conversion failure', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
    mockPdfConvert.mockRejectedValueOnce(new Error('Poppler not found'))

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('CONVERSION_FAILED')
    expect(result.error).toContain('chuyển đổi')
  })

  it('handles missing output files after conversion', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
    mockPdfConvert.mockResolvedValueOnce(undefined)
    mockFsReadFile.mockRejectedValueOnce(new Error('ENOENT'))

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('CONVERSION_FAILED')
  })

  it('tracks processing time', async () => {
    mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
    mockPdfConvert.mockResolvedValueOnce(undefined)
    mockFsReadFile.mockResolvedValueOnce(createMockPngBuffer())

    const result = await convertPdfToImages(createValidPdfBuffer())

    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('cleans up temp files on success', async () => {
    const mockRm = vi.mocked(fs.rm)
    mockPdfInfo.mockResolvedValueOnce({ pages: 1 })
    mockPdfConvert.mockResolvedValueOnce(undefined)
    mockFsReadFile.mockResolvedValueOnce(createMockPngBuffer())

    await convertPdfToImages(createValidPdfBuffer())

    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining('ella-pdf-'),
      expect.objectContaining({ recursive: true, force: true })
    )
  })

  it('cleans up temp files on error', async () => {
    const mockRm = vi.mocked(fs.rm)
    mockPdfInfo.mockResolvedValueOnce({ pages: 15 }) // Too many pages

    await convertPdfToImages(createValidPdfBuffer())

    expect(mockRm).toHaveBeenCalled()
  })
})

describe('getPdfErrorMessage', () => {
  it('returns correct Vietnamese messages', () => {
    const errorTypes: PdfErrorType[] = [
      'INVALID_PDF',
      'ENCRYPTED_PDF',
      'TOO_LARGE',
      'TOO_MANY_PAGES',
      'CONVERSION_FAILED',
      'IO_ERROR',
    ]

    for (const type of errorTypes) {
      const message = getPdfErrorMessage(type)
      expect(message).toBeTruthy()
      expect(typeof message).toBe('string')
    }
  })

  it('returns fallback for unknown type', () => {
    const message = getPdfErrorMessage('UNKNOWN_TYPE' as PdfErrorType)
    expect(message).toContain('chuyển đổi')
  })
})

describe('isPdfMimeType', () => {
  it('returns true for application/pdf', () => {
    expect(isPdfMimeType('application/pdf')).toBe(true)
  })

  it('returns false for image types', () => {
    expect(isPdfMimeType('image/jpeg')).toBe(false)
    expect(isPdfMimeType('image/png')).toBe(false)
    expect(isPdfMimeType('image/webp')).toBe(false)
  })

  it('returns false for other mime types', () => {
    expect(isPdfMimeType('text/plain')).toBe(false)
    expect(isPdfMimeType('application/json')).toBe(false)
  })
})
