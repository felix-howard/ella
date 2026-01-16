/**
 * OCR Extractor Unit Tests
 * Tests for OCR extraction service including PDF support
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractDocumentData,
  getExtractionStatusMessage,
  needsManualVerification,
  type OcrExtractionResult,
} from '../ocr-extractor'

// Mock gemini-client module
vi.mock('../gemini-client', () => ({
  analyzeImage: vi.fn(),
  isGeminiConfigured: true,
}))

// Mock prompts/ocr module
vi.mock('../prompts/ocr', () => ({
  getOcrPromptForDocType: vi.fn().mockReturnValue('Extract W2 data...'),
  supportsOcrExtraction: vi.fn().mockReturnValue(true),
  validateExtractedData: vi.fn().mockReturnValue(true),
  getFieldLabels: vi.fn().mockReturnValue({
    employerName: 'Tên công ty',
    wagesTipsOther: 'Lương, tips và các khoản khác',
  }),
}))

// Mock pdf module
vi.mock('../../pdf', () => ({
  convertPdfToImages: vi.fn(),
  isPdfMimeType: vi.fn().mockImplementation((mimeType: string) => mimeType === 'application/pdf'),
}))

// Get mocks
import { analyzeImage } from '../gemini-client'
import { supportsOcrExtraction, getOcrPromptForDocType } from '../prompts/ocr'
import { convertPdfToImages } from '../../pdf'
const mockAnalyzeImage = vi.mocked(analyzeImage)
const mockSupportsOcr = vi.mocked(supportsOcrExtraction)
const mockGetPrompt = vi.mocked(getOcrPromptForDocType)
const mockConvertPdf = vi.mocked(convertPdfToImages)

// Test image buffer (minimal JPEG magic bytes)
function createTestImageBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

// Test PDF buffer (minimal PDF magic bytes)
function createTestPdfBuffer(): Buffer {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4
}

// Mock W2 extracted data
function createMockW2Data(): Record<string, unknown> {
  return {
    employerName: 'Acme Corp',
    employerEIN: '12-3456789',
    employeeSSN: '***-**-1234',
    wagesTipsOther: '50000.00',
    federalIncomeTaxWithheld: '5000.00',
    socialSecurityWages: '50000.00',
    socialSecurityTaxWithheld: '3100.00',
    medicareWagesAndTips: '50000.00',
    medicareTaxWithheld: '725.00',
  }
}

// Mock PNG buffer for PDF conversion
function createMockPngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
}

describe('extractDocumentData - Image OCR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupportsOcr.mockReturnValue(true)
    mockGetPrompt.mockReturnValue('Extract W2 data...')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts W2 data from image successfully', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: createMockW2Data(),
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(true)
    expect(result.docType).toBe('W2')
    expect(result.extractedData).not.toBeNull()
    expect(result.extractedData?.employerName).toBe('Acme Corp')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.isValid).toBe(true)
  })

  it('handles unsupported mime type', async () => {
    const result = await extractDocumentData(Buffer.from('test'), 'text/plain', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported MIME type')
    expect(mockAnalyzeImage).not.toHaveBeenCalled()
  })

  it('handles unsupported doc type', async () => {
    mockSupportsOcr.mockReturnValue(false)

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'UNKNOWN')

    expect(result.success).toBe(false)
    expect(result.error).toContain('does not support OCR')
  })

  it('handles missing OCR prompt', async () => {
    mockGetPrompt.mockReturnValue(null)

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('No OCR prompt')
  })

  it('handles Gemini API failure', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: false,
      error: 'API error',
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('API error')
  })

  it('tracks processing time', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: createMockW2Data(),
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.processingTimeMs).toBeDefined()
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
  })
})

describe('extractDocumentData - PDF OCR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupportsOcr.mockReturnValue(true)
    mockGetPrompt.mockReturnValue('Extract W2 data...')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts data from single-page PDF', async () => {
    // Mock PDF conversion
    mockConvertPdf.mockResolvedValueOnce({
      success: true,
      pages: [{ pageNumber: 1, buffer: createMockPngBuffer(), mimeType: 'image/png' }],
      totalPages: 1,
    })

    // Mock OCR for the page
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: createMockW2Data(),
    })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    expect(result.success).toBe(true)
    expect(result.docType).toBe('W2')
    expect(result.pageCount).toBe(1)
    expect(result.pageConfidences).toHaveLength(1)
    expect(result.extractedData?.employerName).toBe('Acme Corp')
    expect(mockConvertPdf).toHaveBeenCalledWith(expect.any(Buffer))
  })

  it('extracts and merges data from multi-page PDF', async () => {
    // Mock PDF conversion with 2 pages
    mockConvertPdf.mockResolvedValueOnce({
      success: true,
      pages: [
        { pageNumber: 1, buffer: createMockPngBuffer(), mimeType: 'image/png' },
        { pageNumber: 2, buffer: createMockPngBuffer(), mimeType: 'image/png' },
      ],
      totalPages: 2,
    })

    // Page 1 data
    const page1Data = {
      employerName: 'Acme Corp',
      employerEIN: '12-3456789',
      wagesTipsOther: '50000.00',
    }

    // Page 2 data (partial, should override page 1 where present)
    const page2Data = {
      employerName: 'Acme Corporation', // Updated name
      federalIncomeTaxWithheld: '5000.00',
    }

    mockAnalyzeImage
      .mockResolvedValueOnce({ success: true, data: page1Data })
      .mockResolvedValueOnce({ success: true, data: page2Data })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    expect(result.success).toBe(true)
    expect(result.pageCount).toBe(2)
    expect(result.pageConfidences).toHaveLength(2)
    // Page 2 should override page 1 for employerName
    expect(result.extractedData?.employerName).toBe('Acme Corporation')
    // Page 1 data should be preserved where page 2 doesn't have it
    expect(result.extractedData?.employerEIN).toBe('12-3456789')
    expect(result.extractedData?.wagesTipsOther).toBe('50000.00')
    // Page 2 data
    expect(result.extractedData?.federalIncomeTaxWithheld).toBe('5000.00')
  })

  it('handles PDF conversion failure', async () => {
    mockConvertPdf.mockResolvedValueOnce({
      success: false,
      error: 'Tệp PDF không hợp lệ',
      errorType: 'INVALID_PDF',
    })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('PDF')
    expect(mockAnalyzeImage).not.toHaveBeenCalled()
  })

  it('handles encrypted PDF', async () => {
    mockConvertPdf.mockResolvedValueOnce({
      success: false,
      error: 'Tệp PDF được bảo vệ bằng mật khẩu',
      errorType: 'ENCRYPTED_PDF',
    })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('mật khẩu')
  })

  it('handles OCR failure on all pages', async () => {
    mockConvertPdf.mockResolvedValueOnce({
      success: true,
      pages: [
        { pageNumber: 1, buffer: createMockPngBuffer(), mimeType: 'image/png' },
        { pageNumber: 2, buffer: createMockPngBuffer(), mimeType: 'image/png' },
      ],
      totalPages: 2,
    })

    // Both pages fail
    mockAnalyzeImage
      .mockResolvedValueOnce({ success: false, error: 'OCR failed' })
      .mockResolvedValueOnce({ success: false, error: 'OCR failed' })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    expect(result.success).toBe(false)
    expect(result.pageCount).toBe(2)
    expect(result.error).toContain('Không thể trích xuất')
  })

  it('handles partial OCR success (some pages fail)', async () => {
    mockConvertPdf.mockResolvedValueOnce({
      success: true,
      pages: [
        { pageNumber: 1, buffer: createMockPngBuffer(), mimeType: 'image/png' },
        { pageNumber: 2, buffer: createMockPngBuffer(), mimeType: 'image/png' },
      ],
      totalPages: 2,
    })

    // Page 1 succeeds, page 2 fails
    mockAnalyzeImage
      .mockResolvedValueOnce({ success: true, data: createMockW2Data() })
      .mockResolvedValueOnce({ success: false, error: 'Page 2 unreadable' })

    const result = await extractDocumentData(createTestPdfBuffer(), 'application/pdf', 'W2')

    // Should succeed with page 1 data only
    expect(result.success).toBe(true)
    expect(result.pageCount).toBe(2)
    expect(result.pageConfidences).toHaveLength(1) // Only 1 successful page
    expect(result.extractedData?.employerName).toBe('Acme Corp')
  })
})

describe('getExtractionStatusMessage', () => {
  it('returns error message for failed extraction', () => {
    const result: OcrExtractionResult = {
      success: false,
      docType: 'W2',
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: 'API error',
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('Lỗi')
    expect(message).toContain('API error')
  })

  it('returns validation message for invalid data', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: {},
      confidence: 0.8,
      isValid: false,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('không hợp lệ')
  })

  it('returns high confidence message', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.92,
      isValid: true,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('độ tin cậy cao')
  })

  it('returns medium confidence message', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.75,
      isValid: true,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('cần xác minh')
  })
})

describe('needsManualVerification', () => {
  it('returns true for failed extraction', () => {
    const result: OcrExtractionResult = {
      success: false,
      docType: 'W2',
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns true for invalid data', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: {},
      confidence: 0.9,
      isValid: false,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns true for low confidence', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.7,
      isValid: true,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns false for high confidence valid extraction', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.92,
      isValid: true,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(false)
  })
})
