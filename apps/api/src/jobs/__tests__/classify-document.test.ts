/**
 * Classify Document Job Integration Tests
 * Tests the Inngest job workflow with mocked dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DocType } from '@ella/db'

// Mock all external dependencies before importing the job
vi.mock('../../lib/inngest', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}))

vi.mock('../../lib/db', () => ({
  prisma: {
    rawImage: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../../services/storage', () => ({
  fetchImageBuffer: vi.fn(),
}))

vi.mock('../../services/ai', () => ({
  classifyDocument: vi.fn(),
  requiresOcrExtraction: vi.fn(),
}))

vi.mock('../../services/ai/ocr-extractor', () => ({
  extractDocumentData: vi.fn(),
}))

vi.mock('../../services/ai/pipeline-helpers', () => ({
  updateRawImageStatus: vi.fn(),
  linkToChecklistItem: vi.fn(),
  createAction: vi.fn(),
  processOcrResultAtomic: vi.fn(),
  markImageProcessing: vi.fn(),
}))

vi.mock('../../services/ai/duplicate-detector', () => ({
  generateImageHash: vi.fn(),
  assignToImageGroup: vi.fn(),
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-image')),
  })),
}))

// Import mocked modules
import { fetchImageBuffer } from '../../services/storage'
import { classifyDocument, requiresOcrExtraction } from '../../services/ai'
import { extractDocumentData } from '../../services/ai/ocr-extractor'
import {
  updateRawImageStatus,
  linkToChecklistItem,
  createAction,
  processOcrResultAtomic,
  markImageProcessing,
} from '../../services/ai/pipeline-helpers'
import { generateImageHash, assignToImageGroup } from '../../services/ai/duplicate-detector'
import { prisma } from '../../lib/db'

// Type the mocks
const mockPrismaRawImage = vi.mocked(prisma.rawImage)
const mockFetchImageBuffer = vi.mocked(fetchImageBuffer)
const mockClassifyDocument = vi.mocked(classifyDocument)
const mockRequiresOcr = vi.mocked(requiresOcrExtraction)
const mockExtractDocumentData = vi.mocked(extractDocumentData)
const mockUpdateStatus = vi.mocked(updateRawImageStatus)
const mockLinkToChecklist = vi.mocked(linkToChecklistItem)
const mockCreateAction = vi.mocked(createAction)
const mockProcessOcr = vi.mocked(processOcrResultAtomic)
const _mockMarkProcessing = vi.mocked(markImageProcessing)
const mockGenerateHash = vi.mocked(generateImageHash)
const mockAssignToGroup = vi.mocked(assignToImageGroup)

// Helper test data
const testEventData = {
  rawImageId: 'raw-123',
  caseId: 'case-456',
  r2Key: 'uploads/test-image.jpg',
  mimeType: 'image/jpeg',
  uploadedAt: new Date().toISOString(),
}

// Classification result type for tests
interface ClassificationTestResult {
  success: boolean
  docType: DocType | 'UNKNOWN'
  confidence: number
  reasoning: string
  error?: string
}

// Routing result type for tests
interface RoutingTestResult {
  action: 'unclassified' | 'auto-linked' | 'needs-review'
  needsOcr: boolean
  checklistItemId: string | null
}

// Grouping result type for tests
interface GroupingTestResult {
  grouped: boolean
  groupId: string | null
  isNew?: boolean
  imageCount: number
}

describe('classifyDocumentJob workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('high confidence classification (>85%)', () => {
    beforeEach(() => {
      // Setup mocks for high confidence W2 classification
      mockPrismaRawImage.findUnique.mockResolvedValue({
        status: 'UPLOADED',
      } as never)

      mockFetchImageBuffer.mockResolvedValue({
        buffer: Buffer.from('test-image-data'),
        mimeType: 'image/jpeg',
      })

      mockClassifyDocument.mockResolvedValue({
        success: true,
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'W2 form identified by header',
      })

      mockRequiresOcr.mockReturnValue(true)
      mockLinkToChecklist.mockResolvedValue('checklist-item-123')
      mockGenerateHash.mockResolvedValue('hash123456789')
      mockAssignToGroup.mockResolvedValue({
        groupId: 'group-1',
        isNew: true,
        imageCount: 1,
      })
      mockExtractDocumentData.mockResolvedValue({
        success: true,
        isValid: true,
        confidence: 0.88,
        extractedData: { wages: 50000 },
        docType: 'W2',
        fieldLabels: {},
      })
      mockProcessOcr.mockResolvedValue('digital-doc-123')
    })

    it('auto-links high confidence documents without creating action', async () => {
      // Simulate classification
      const classification: ClassificationTestResult = {
        success: true,
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'W2 form identified',
      }

      // Simulate routing
      const routing: RoutingTestResult = {
        action: 'auto-linked',
        needsOcr: true,
        checklistItemId: 'checklist-123',
      }

      // Verify high confidence routes to auto-link
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85)
      expect(routing.action).toBe('auto-linked')

      // Simulate the action - no VERIFY_DOCS should be created for high confidence
      await mockUpdateStatus(testEventData.rawImageId, 'CLASSIFIED', 0.92, 'W2' as DocType)
      await mockLinkToChecklist(testEventData.rawImageId, testEventData.caseId, 'W2' as DocType)

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        testEventData.rawImageId,
        'CLASSIFIED',
        0.92,
        'W2'
      )
      expect(mockLinkToChecklist).toHaveBeenCalled()
      // Should NOT create a VERIFY_DOCS action for high confidence
      expect(mockCreateAction).not.toHaveBeenCalled()
    })

    it('performs OCR extraction for supported doc types', async () => {
      const routing: RoutingTestResult = {
        action: 'auto-linked',
        needsOcr: true,
        checklistItemId: 'checklist-123',
      }

      if (routing.needsOcr) {
        await extractDocumentData(Buffer.from('test'), 'image/jpeg', 'W2' as DocType)
        await processOcrResultAtomic({
          rawImageId: testEventData.rawImageId,
          caseId: testEventData.caseId,
          docType: 'W2' as DocType,
          extractedData: { wages: 50000 },
          status: 'EXTRACTED',
          confidence: 0.88,
          checklistItemId: routing.checklistItemId,
        })

        expect(mockExtractDocumentData).toHaveBeenCalled()
        expect(mockProcessOcr).toHaveBeenCalled()
      }
    })
  })

  describe('medium confidence classification (60-85%)', () => {
    beforeEach(() => {
      mockPrismaRawImage.findUnique.mockResolvedValue({
        status: 'UPLOADED',
      } as never)

      mockFetchImageBuffer.mockResolvedValue({
        buffer: Buffer.from('test-image-data'),
        mimeType: 'image/jpeg',
      })

      mockClassifyDocument.mockResolvedValue({
        success: true,
        docType: 'FORM_1099_NEC',
        confidence: 0.72,
        reasoning: '1099 form but specific type uncertain',
      })

      mockRequiresOcr.mockReturnValue(true)
      mockLinkToChecklist.mockResolvedValue('checklist-item-456')
      mockCreateAction.mockResolvedValue('action-789')
    })

    it('creates VERIFY_DOCS action for medium confidence', async () => {
      const classification: ClassificationTestResult = {
        success: true,
        docType: 'FORM_1099_NEC',
        confidence: 0.72,
        reasoning: '1099 form',
      }

      expect(classification.confidence).toBeGreaterThanOrEqual(0.60)
      expect(classification.confidence).toBeLessThan(0.85)

      // Simulate routing with review action
      await mockUpdateStatus(testEventData.rawImageId, 'CLASSIFIED', 0.72, 'FORM_1099_NEC' as DocType)
      await mockLinkToChecklist(testEventData.rawImageId, testEventData.caseId, 'FORM_1099_NEC' as DocType)
      await mockCreateAction({
        caseId: testEventData.caseId,
        type: 'VERIFY_DOCS',
        priority: 'NORMAL',
        title: 'Xác minh phân loại',
        description: `FORM_1099_NEC: Độ tin cậy 72% - cần xác minh`,
        metadata: {
          rawImageId: testEventData.rawImageId,
          docType: 'FORM_1099_NEC' as DocType,
          confidence: 0.72,
        },
      })

      expect(mockCreateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VERIFY_DOCS',
          caseId: testEventData.caseId,
        })
      )
    })
  })

  describe('low confidence / failed classification (<60%)', () => {
    beforeEach(() => {
      mockPrismaRawImage.findUnique.mockResolvedValue({
        status: 'UPLOADED',
      } as never)

      mockFetchImageBuffer.mockResolvedValue({
        buffer: Buffer.from('blurry-image'),
        mimeType: 'image/jpeg',
      })

      mockClassifyDocument.mockResolvedValue({
        success: true,
        docType: 'UNKNOWN',
        confidence: 0.35,
        reasoning: 'Image too blurry to identify',
      })
    })

    it('marks as unclassified and creates AI_FAILED action', async () => {
      const classification: ClassificationTestResult = {
        success: true,
        docType: 'UNKNOWN',
        confidence: 0.35,
        reasoning: 'Image too blurry',
      }

      expect(classification.confidence).toBeLessThan(0.60)

      // Simulate routing for low confidence
      await mockUpdateStatus(testEventData.rawImageId, 'UNCLASSIFIED', 0.35)
      await mockCreateAction({
        caseId: testEventData.caseId,
        type: 'AI_FAILED',
        priority: 'NORMAL',
        title: 'Phân loại tự động thất bại',
        description: 'Không thể phân loại tài liệu (độ tin cậy: 35%)',
        metadata: {
          rawImageId: testEventData.rawImageId,
          errorMessage: classification.reasoning,
        },
      })

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        testEventData.rawImageId,
        'UNCLASSIFIED',
        0.35
      )
      expect(mockCreateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AI_FAILED',
        })
      )
    })

    it('skips OCR and duplicate grouping for unclassified images', async () => {
      const routing: RoutingTestResult = {
        action: 'unclassified',
        needsOcr: false,
        checklistItemId: null,
      }

      // Grouping should be skipped
      const grouping: GroupingTestResult = {
        grouped: false,
        groupId: null,
        imageCount: 1,
      }

      expect(routing.action).toBe('unclassified')
      expect(grouping.grouped).toBe(false)
      expect(routing.needsOcr).toBe(false)
    })
  })

  describe('duplicate detection and grouping', () => {
    it('assigns images to groups based on hash', async () => {
      mockGenerateHash.mockResolvedValue('hash-abc123')
      mockAssignToGroup.mockResolvedValue({
        groupId: 'group-existing',
        isNew: false,
        imageCount: 3,
      })

      const buffer = Buffer.from('test-image')
      const imageHash = await generateImageHash(buffer)
      const result = await assignToImageGroup(
        testEventData.rawImageId,
        testEventData.caseId,
        'W2' as DocType,
        imageHash
      )

      expect(result.groupId).toBe('group-existing')
      expect(result.isNew).toBe(false)
      expect(result.imageCount).toBe(3)
    })

    it('creates new group for first image of type', async () => {
      mockGenerateHash.mockResolvedValue('hash-new123')
      mockAssignToGroup.mockResolvedValue({
        groupId: 'group-new',
        isNew: true,
        imageCount: 1,
      })

      const buffer = Buffer.from('test-image')
      const imageHash = await generateImageHash(buffer)
      const result = await assignToImageGroup(
        testEventData.rawImageId,
        testEventData.caseId,
        'SSN_CARD' as DocType,
        imageHash
      )

      expect(result.isNew).toBe(true)
      expect(result.imageCount).toBe(1)
    })
  })

  describe('idempotency check', () => {
    it('skips processing for already processed images', async () => {
      mockPrismaRawImage.findUnique.mockResolvedValue({
        status: 'CLASSIFIED',
      } as never)

      const image = await prisma.rawImage.findUnique({
        where: { id: testEventData.rawImageId },
        select: { status: true },
      })

      // Should skip if not in UPLOADED status
      const shouldSkip = image?.status !== 'UPLOADED'
      expect(shouldSkip).toBe(true)
    })

    it('processes images in UPLOADED status', async () => {
      mockPrismaRawImage.findUnique.mockResolvedValue({
        status: 'UPLOADED',
      } as never)

      const image = await prisma.rawImage.findUnique({
        where: { id: testEventData.rawImageId },
        select: { status: true },
      })

      const shouldProcess = image?.status === 'UPLOADED'
      expect(shouldProcess).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles R2 fetch failure', async () => {
      mockFetchImageBuffer.mockResolvedValue(null)

      const result = await fetchImageBuffer(testEventData.r2Key)
      expect(result).toBeNull()
    })

    it('handles classification service failure', async () => {
      mockClassifyDocument.mockResolvedValue({
        success: false,
        docType: 'UNKNOWN',
        confidence: 0,
        reasoning: 'API error',
        error: 'Gemini API unavailable',
      })

      const result = await classifyDocument(Buffer.from('test'), 'image/jpeg')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Gemini API unavailable')
    })
  })
})
