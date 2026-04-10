/**
 * Document Classifier Unit Tests
 * Tests for document classification service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  classifyDocument,
  batchClassifyDocuments,
  requiresOcrExtraction,
  getDocTypeLabel,
} from '../document-classifier'
import {
  getClassificationPrompt,
  validateClassificationResult,
} from '../prompts/classify'

// Mock gemini-client module
vi.mock('../gemini-client', () => ({
  analyzeImage: vi.fn(),
  isGeminiConfigured: true,
}))

// Get the mock
import { analyzeImage } from '../gemini-client'
const mockAnalyzeImage = vi.mocked(analyzeImage)

// Test image buffer (minimal JPEG magic bytes)
function createTestImageBuffer(): Buffer {
  // JPEG magic bytes: FF D8 FF + some filler
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

describe('classifyDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('classifies W2 form correctly', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'Form shows Wage and Tax Statement header, boxes for wages and withholding',
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(true)
    expect(result.docType).toBe('W2')
    expect(result.confidence).toBeGreaterThan(0.8)
    expect(result.reasoning).toContain('Wage')
  })

  it('returns UNKNOWN for unclear images with low confidence', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'UNKNOWN',
        confidence: 0.35,
        reasoning: 'Image is too blurry to identify document type',
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.docType).toBe('UNKNOWN')
    expect(result.confidence).toBeLessThan(0.6)
  })

  it('handles unsupported mime types', async () => {
    const buffer = Buffer.from('not an image')
    const result = await classifyDocument(buffer, 'text/plain')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported')
    // Should not call Gemini for unsupported types
    expect(mockAnalyzeImage).not.toHaveBeenCalled()
  })

  it('handles Gemini API failures gracefully', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: false,
      error: 'API rate limit exceeded',
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(false)
    expect(result.docType).toBe('UNKNOWN')
    expect(result.error).toBeDefined()
  })

  it('handles Gemini API exceptions', async () => {
    mockAnalyzeImage.mockRejectedValueOnce(new Error('Network error'))

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(false)
    expect(result.docType).toBe('UNKNOWN')
    expect(result.error).toBe('Network error')
  })

  it('handles invalid AI response structure', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        // Missing required fields
        docType: 'W2',
        // No confidence or reasoning
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(false)
    expect(result.error).toContain('invalid')
  })

  it('includes alternativeTypes for medium confidence', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'FORM_1099_NEC',
        confidence: 0.72,
        reasoning: 'Appears to be 1099 form but variant unclear',
        alternativeTypes: [
          { docType: 'FORM_1099_MISC', confidence: 0.25 },
        ],
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(true)
    expect(result.alternativeTypes).toBeDefined()
    expect(result.alternativeTypes?.length).toBeGreaterThan(0)
  })

  it('tracks processing time', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'SSN_CARD',
        confidence: 0.95,
        reasoning: 'SSN card format with SSN visible',
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.processingTimeMs).toBeDefined()
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
  })
})

describe('batchClassifyDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes multiple documents', async () => {
    const responses = [
      { success: true, data: { docType: 'W2', confidence: 0.9, reasoning: 'W2 form' } },
      { success: true, data: { docType: 'SSN_CARD', confidence: 0.95, reasoning: 'SSN card' } },
    ]

    mockAnalyzeImage
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])

    const images = [
      { buffer: createTestImageBuffer(), mimeType: 'image/jpeg', id: 'img-1' },
      { buffer: createTestImageBuffer(), mimeType: 'image/jpeg', id: 'img-2' },
    ]

    const results = await batchClassifyDocuments(images, 2)

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('img-1')
    expect(results[0].result.docType).toBe('W2')
    expect(results[1].id).toBe('img-2')
    expect(results[1].result.docType).toBe('SSN_CARD')
  })

  it('respects concurrency limit', async () => {
    // Track concurrent calls
    let concurrentCalls = 0
    let maxConcurrent = 0

    mockAnalyzeImage.mockImplementation(async () => {
      concurrentCalls++
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls)
      await new Promise((r) => setTimeout(r, 10))
      concurrentCalls--
      return {
        success: true,
        data: { docType: 'W2', confidence: 0.9, reasoning: 'W2 form' },
      }
    })

    const images = Array.from({ length: 6 }, (_, i) => ({
      buffer: createTestImageBuffer(),
      mimeType: 'image/jpeg',
      id: `img-${i}`,
    }))

    await batchClassifyDocuments(images, 2)

    // Max concurrent should not exceed the limit
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })
})

describe('requiresOcrExtraction', () => {
  it('returns true for W2', () => {
    expect(requiresOcrExtraction('W2')).toBe(true)
  })

  it('returns true for 1099 forms', () => {
    expect(requiresOcrExtraction('FORM_1099_INT')).toBe(true)
    expect(requiresOcrExtraction('FORM_1099_NEC')).toBe(true)
    expect(requiresOcrExtraction('FORM_1099_R')).toBe(true)
  })

  it('returns true for ID documents', () => {
    expect(requiresOcrExtraction('SSN_CARD')).toBe(true)
    expect(requiresOcrExtraction('DRIVER_LICENSE')).toBe(true)
  })

  it('returns false for UNKNOWN', () => {
    expect(requiresOcrExtraction('UNKNOWN')).toBe(false)
  })

  it('returns true for types previously excluded (generic fallback now handles them)', () => {
    expect(requiresOcrExtraction('RECEIPT')).toBe(true)
    expect(requiresOcrExtraction('PASSPORT')).toBe(true)
  })

  it('returns false for OTHER', () => {
    expect(requiresOcrExtraction('OTHER')).toBe(false)
  })
})

describe('getDocTypeLabel', () => {
  it('returns Vietnamese labels for doc types', () => {
    expect(getDocTypeLabel('W2')).toBe('W2 (Thu nhập từ công việc)')
    expect(getDocTypeLabel('SSN_CARD')).toBe('Thẻ SSN')
    expect(getDocTypeLabel('DRIVER_LICENSE')).toBe('Bằng Lái / ID')
  })

  it('returns default for UNKNOWN', () => {
    expect(getDocTypeLabel('UNKNOWN')).toBe('Chưa xác định')
  })
})

describe('entity routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const entityContext = {
    entities: [
      { id: 'cl_ind', name: 'Messi Tran', type: 'individual' as const },
      { id: 'cl_biz', name: 'Yenu Nail Spa', type: 'business' as const, businessType: 'LLC' },
    ],
  }

  it('returns entity routing fields when entity context provided', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'BANK_STATEMENT',
        confidence: 0.9,
        reasoning: 'Business bank statement for Yenu Nail Spa',
        targetEntityId: 'cl_biz',
        entityConfidence: 0.85,
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg', entityContext)

    expect(result.success).toBe(true)
    expect(result.targetEntityId).toBe('cl_biz')
    expect(result.entityConfidence).toBe(0.85)
  })

  it('clears entityConfidence when targetEntityId is null', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'W2 form',
        targetEntityId: null,
        entityConfidence: 0.5,
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg', entityContext)

    expect(result.success).toBe(true)
    expect(result.targetEntityId).toBeNull()
    expect(result.entityConfidence).toBeUndefined()
  })

  it('works without entity context (backward compatible)', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: {
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'W2 form',
      },
    })

    const buffer = createTestImageBuffer()
    const result = await classifyDocument(buffer, 'image/jpeg')

    expect(result.success).toBe(true)
    expect(result.targetEntityId).toBeNull()
    expect(result.entityConfidence).toBeUndefined()
  })

  it('forwards entity context through batchClassifyDocuments', async () => {
    mockAnalyzeImage.mockResolvedValue({
      success: true,
      data: {
        docType: 'BANK_STATEMENT',
        confidence: 0.88,
        reasoning: 'Bank statement',
        targetEntityId: 'cl_biz',
        entityConfidence: 0.8,
      },
    })

    const images = [
      { buffer: createTestImageBuffer(), mimeType: 'image/jpeg', id: 'img-1' },
    ]

    const results = await batchClassifyDocuments(images, 2, entityContext)

    expect(results[0].result.targetEntityId).toBe('cl_biz')
    // Verify prompt was called (entity context passed through)
    expect(mockAnalyzeImage).toHaveBeenCalledTimes(1)
  })
})

describe('getClassificationPrompt - entity routing', () => {

  it('does not include entity routing without context', () => {
    const prompt = getClassificationPrompt()
    expect(prompt).not.toContain('ENTITY ROUTING')
    expect(prompt).not.toContain('targetEntityId')
  })

  it('does not include entity routing for single entity', () => {
    const prompt = getClassificationPrompt({
      entities: [{ id: 'cl_1', name: 'Messi', type: 'individual' }],
    })
    expect(prompt).not.toContain('ENTITY ROUTING')
  })

  it('includes entity routing for multiple entities', () => {
    const prompt = getClassificationPrompt({
      entities: [
        { id: 'cl_ind', name: 'Messi Tran', type: 'individual' },
        { id: 'cl_biz', name: 'Yenu Nail Spa', type: 'business', businessType: 'LLC' },
      ],
    })
    expect(prompt).toContain('ENTITY ROUTING')
    expect(prompt).toContain('cl_ind')
    expect(prompt).toContain('cl_biz')
    expect(prompt).toContain('Yenu Nail Spa (LLC)')
    expect(prompt).toContain('targetEntityId')
    expect(prompt).toContain('entityConfidence')
  })
})

describe('validateClassificationResult - entity fields', () => {

  it('accepts valid entity routing fields', () => {
    const result = {
      docType: 'W2',
      confidence: 0.9,
      reasoning: 'test',
      targetEntityId: 'cl_123',
      entityConfidence: 0.85,
    }
    expect(validateClassificationResult(result)).toBe(true)
  })

  it('accepts null targetEntityId', () => {
    const result = {
      docType: 'W2',
      confidence: 0.9,
      reasoning: 'test',
      targetEntityId: null,
      entityConfidence: 0.5,
    }
    expect(validateClassificationResult(result)).toBe(true)
  })

  it('accepts result without entity fields (backward compat)', () => {
    const result = {
      docType: 'W2',
      confidence: 0.9,
      reasoning: 'test',
    }
    expect(validateClassificationResult(result)).toBe(true)
  })

  it('rejects non-string targetEntityId', () => {
    const result = {
      docType: 'W2',
      confidence: 0.9,
      reasoning: 'test',
      targetEntityId: 123,
    }
    expect(validateClassificationResult(result)).toBe(false)
  })

  it('rejects entityConfidence out of range', () => {
    const result = {
      docType: 'W2',
      confidence: 0.9,
      reasoning: 'test',
      entityConfidence: 1.5,
    }
    expect(validateClassificationResult(result)).toBe(false)
  })
})
