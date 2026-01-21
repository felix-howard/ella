/**
 * Document Classification Job
 * Background job for AI-powered document classification using Gemini
 *
 * Workflow:
 * 1. Idempotency check (skip if already processed)
 * 2. Fetch image from R2 (with resize for large files)
 * 3. Check for duplicates (pHash) - skip AI if duplicate found
 * 4. Classify with Gemini (with error handling for unavailability)
 * 5. Route by confidence (>85% auto-link, 60-85% review, <60% unclassified)
 * 6. OCR extraction (if confidence >= 60% and doc type supports OCR)
 * 7. Update DB with results
 */

import sharp from 'sharp'
import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { fetchImageBuffer } from '../services/storage'
import { classifyDocument, requiresOcrExtraction } from '../services/ai'
import { isPdfMimeType } from '../services/pdf/pdf-converter'
import { extractDocumentData } from '../services/ai/ocr-extractor'
import {
  updateRawImageStatus,
  linkToChecklistItem,
  createAction,
  processOcrResultAtomic,
  markImageDuplicate,
} from '../services/ai/pipeline-helpers'
import {
  getVietnameseError,
  getActionTitle,
  getActionPriority,
} from '../services/ai/ai-error-messages'
import { generateImageHash, findDuplicateInCase } from '../services/ai/duplicate-detector'
import type { DocType } from '@ella/db'

// Confidence thresholds from plan
const HIGH_CONFIDENCE = 0.85
const LOW_CONFIDENCE = 0.60

// Image size thresholds
const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB - trigger resize
const HARD_SIZE_LIMIT = 20 * 1024 * 1024 // 20MB - reject outright

// Gemini service unavailability patterns
const SERVICE_UNAVAILABLE_PATTERNS = [
  /503/,
  /service.?unavailable/i,
  /overloaded/i,
  /resource.?exhausted/i,
]

/**
 * Check if error indicates Gemini service unavailability
 */
function isServiceUnavailable(errorMessage: string): boolean {
  return SERVICE_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(errorMessage))
}

/**
 * Sanitize error message for storage - remove sensitive info
 */
function sanitizeErrorMessage(error: string): string {
  return error
    // Remove API keys (AIza..., sk-...)
    .replace(/(?:AIza|sk-)[a-zA-Z0-9_-]{20,}/g, '[API_KEY_REDACTED]')
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    // Remove file paths
    .replace(/(?:\/|\\)[a-zA-Z0-9._-]+(?:\/|\\)[a-zA-Z0-9._/-]+/g, '[PATH_REDACTED]')
    // Truncate long messages
    .substring(0, 500)
}

export const classifyDocumentJob = inngest.createFunction(
  {
    id: 'classify-document',
    retries: 3,
    throttle: { limit: 10, period: '1m' }, // Gemini rate limit protection
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { rawImageId, caseId, r2Key, mimeType: eventMimeType, skipDuplicateCheck } = event.data

    // Step 0: Atomic idempotency check + mark processing (prevents race condition)
    const idempotencyCheck = await step.run('check-idempotency', async () => {
      // Atomic compare-and-swap: only update if status is UPLOADED
      const updated = await prisma.rawImage.updateMany({
        where: { id: rawImageId, status: 'UPLOADED' },
        data: { status: 'PROCESSING' },
      })

      // If no rows updated, image was already processed or doesn't exist
      if (updated.count === 0) {
        const image = await prisma.rawImage.findUnique({
          where: { id: rawImageId },
          select: { status: true },
        })
        return { skip: true, status: image?.status || 'NOT_FOUND' }
      }

      return { skip: false, status: 'PROCESSING' }
    })

    // Exit early if already processed
    if (idempotencyCheck.skip) {
      return {
        skipped: true,
        reason: 'Already processed',
        currentStatus: idempotencyCheck.status,
        rawImageId,
      }
    }

    // Step 1: Fetch file from R2 with resize for large images
    // PDFs are sent directly to Gemini (native PDF support for better accuracy)
    const imageData = await step.run('fetch-image', async () => {
      const result = await fetchImageBuffer(r2Key)
      if (!result) {
        throw new Error(`Failed to fetch file from R2: ${r2Key}`)
      }

      // Hard size limit - reject files over 20MB to prevent DoS
      if (result.buffer.length > HARD_SIZE_LIMIT) {
        const sizeMB = (result.buffer.length / 1024 / 1024).toFixed(2)
        throw new Error(`File too large (${sizeMB}MB). Maximum allowed: 20MB`)
      }

      let buffer = result.buffer
      let mimeType = result.mimeType || eventMimeType
      let wasResized = false

      // Only resize large images (not PDFs) - Gemini reads PDFs natively
      const isPdf = isPdfMimeType(mimeType)
      if (!isPdf && buffer.length > MAX_IMAGE_SIZE) {
        console.log(`[classify-document] Resizing large image: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`)
        buffer = await sharp(buffer)
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        mimeType = 'image/jpeg'
        wasResized = true
      }

      // PDFs: Send directly to Gemini (no conversion needed)
      // Gemini 2.0/2.5 Flash has native PDF support with better accuracy
      if (isPdf) {
        console.log(`[classify-document] Using native PDF reading (no conversion)`)
      }

      // Store as base64 for step durability (Inngest serializes step results)
      return {
        buffer: buffer.toString('base64'),
        mimeType,
        wasResized,
        isPdf,
      }
    })

    // Step 1.5: Check for duplicates BEFORE AI classification (cost saving)
    // Skip if: 1) flag set (classify-anyway), 2) PDF (pHash doesn't work well), 3) was resized
    interface DuplicateCheckStepResult {
      isDuplicate: boolean
      skipped: boolean
      imageHash: string | null
      matchedImageId: string | null
      groupId: string | null
      hammingDistance: number | null
    }

    const duplicateCheck = await step.run('check-duplicate', async (): Promise<DuplicateCheckStepResult> => {
      // Skip duplicate check if requested (classify-anyway endpoint)
      if (skipDuplicateCheck) {
        return { isDuplicate: false, skipped: true, imageHash: null, matchedImageId: null, groupId: null, hammingDistance: null }
      }

      // Skip for PDFs - pHash works on images only
      if (imageData.isPdf) {
        return { isDuplicate: false, skipped: true, imageHash: null, matchedImageId: null, groupId: null, hammingDistance: null }
      }

      try {
        const buffer = Buffer.from(imageData.buffer, 'base64')
        const imageHash = await generateImageHash(buffer)

        // Check for duplicates in this case
        const result = await findDuplicateInCase(caseId, imageHash, rawImageId)

        if (result.isDuplicate) {
          // Mark as duplicate and store hash
          await markImageDuplicate(rawImageId, imageHash, result.groupId, result.matchedImageId)

          return {
            isDuplicate: true,
            skipped: false,
            imageHash,
            matchedImageId: result.matchedImageId,
            groupId: result.groupId,
            hammingDistance: result.hammingDistance,
          }
        }

        // Not a duplicate - store hash for future comparisons
        await prisma.rawImage.update({
          where: { id: rawImageId },
          data: { imageHash },
        })

        return { isDuplicate: false, skipped: false, imageHash, matchedImageId: null, groupId: null, hammingDistance: null }
      } catch (error) {
        // Hash generation failed - continue to classification
        console.warn(`[classify-document] Hash generation failed for ${rawImageId}:`, error)
        return { isDuplicate: false, skipped: true, imageHash: null, matchedImageId: null, groupId: null, hammingDistance: null }
      }
    })

    // Early return if duplicate found - skip AI classification (cost saving)
    if (duplicateCheck.isDuplicate) {
      return {
        rawImageId,
        duplicateDetected: true,
        matchedImageId: duplicateCheck.matchedImageId,
        groupId: duplicateCheck.groupId,
        hammingDistance: duplicateCheck.hammingDistance,
        wasResized: imageData.wasResized,
      }
    }

    // Step 2: Classify with Gemini (with service unavailability handling)
    const classification = await step.run('classify', async () => {
      const buffer = Buffer.from(imageData.buffer, 'base64')

      try {
        const result = await classifyDocument(buffer, imageData.mimeType)

        // Check for service unavailability in error message
        if (!result.success && result.error && isServiceUnavailable(result.error)) {
          const errorInfo = getVietnameseError(result.error)

          // Mark for manual classification and create action with Vietnamese message
          await updateRawImageStatus(rawImageId, 'UNCLASSIFIED', 0)
          await createAction({
            caseId,
            type: 'AI_FAILED',
            priority: getActionPriority(errorInfo.severity),
            title: getActionTitle(errorInfo.type),
            description: errorInfo.message,
            metadata: {
              rawImageId,
              r2Key,
              errorType: errorInfo.type,
              technicalError: sanitizeErrorMessage(result.error),
              attemptedAt: new Date().toISOString(),
            },
          })
          // Throw to trigger Inngest retry
          throw new Error(`Gemini service unavailable: ${result.error}`)
        }

        return {
          success: result.success,
          docType: result.docType,
          confidence: result.confidence,
          reasoning: result.reasoning,
          error: result.error,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // If it's a service unavailability, re-throw for Inngest retry
        if (isServiceUnavailable(errorMessage)) {
          throw error
        }

        // Other errors - return as failed classification
        return {
          success: false,
          docType: 'UNKNOWN' as const,
          confidence: 0,
          reasoning: 'Classification error occurred',
          error: errorMessage,
        }
      }
    })

    // Step 3: Route by confidence and update DB
    const routing = await step.run('route-by-confidence', async () => {
      const { confidence, docType, success, error } = classification

      // Failed classification or very low confidence → unclassified
      if (!success || confidence < LOW_CONFIDENCE) {
        const errorInfo = getVietnameseError(error || classification.reasoning)

        await updateRawImageStatus(rawImageId, 'UNCLASSIFIED', confidence)

        // Create AI_FAILED action with Vietnamese message for CPA visibility
        await createAction({
          caseId,
          type: 'AI_FAILED',
          priority: getActionPriority(errorInfo.severity),
          title: getActionTitle(errorInfo.type),
          description: errorInfo.message,
          metadata: {
            rawImageId,
            errorType: errorInfo.type,
            technicalError: sanitizeErrorMessage(error || classification.reasoning),
            r2Key,
            attemptedAt: new Date().toISOString(),
          },
        })

        return { action: 'unclassified', needsOcr: false, checklistItemId: null }
      }

      // Cast docType to proper enum type
      const validDocType = docType as DocType

      // High confidence (>= 85%) → auto-link without action
      if (confidence >= HIGH_CONFIDENCE) {
        await updateRawImageStatus(rawImageId, 'CLASSIFIED', confidence, validDocType)
        const checklistItemId = await linkToChecklistItem(rawImageId, caseId, validDocType)

        return {
          action: 'auto-linked',
          needsOcr: requiresOcrExtraction(validDocType),
          checklistItemId,
        }
      }

      // Medium confidence (60-85%) → link but create review action
      await updateRawImageStatus(rawImageId, 'CLASSIFIED', confidence, validDocType)
      const checklistItemId = await linkToChecklistItem(rawImageId, caseId, validDocType)

      await createAction({
        caseId,
        type: 'VERIFY_DOCS',
        priority: 'NORMAL',
        title: 'Xác minh phân loại',
        description: `${validDocType}: Độ tin cậy ${Math.round(confidence * 100)}% - cần xác minh`,
        metadata: { rawImageId, docType: validDocType, confidence },
      })

      return {
        action: 'needs-review',
        needsOcr: requiresOcrExtraction(validDocType),
        checklistItemId,
      }
    })

    // Step 4: OCR extraction (only if confidence >= 60% and doc type supports OCR)
    // Gemini 2.5 reads PDFs directly for better accuracy
    let digitalDocId: string | undefined
    if (routing.needsOcr) {
      digitalDocId = await step.run('ocr-extract', async () => {
        const buffer = Buffer.from(imageData.buffer, 'base64')
        const validDocType = classification.docType as DocType

        const ocrResult = await extractDocumentData(
          buffer,
          imageData.mimeType,
          validDocType
        )

        // Determine OCR status
        const status = ocrResult.success
          ? ocrResult.isValid
            ? 'EXTRACTED'
            : 'PARTIAL'
          : 'FAILED'

        // Atomic DB update: upsert digital doc, update checklist, mark linked
        return processOcrResultAtomic({
          rawImageId,
          caseId,
          docType: validDocType,
          extractedData: ocrResult.extractedData || {},
          status,
          confidence: ocrResult.confidence,
          checklistItemId: routing.checklistItemId,
        })
      })
    }

    // Return final result
    return {
      rawImageId,
      classification: {
        docType: classification.docType,
        confidence: classification.confidence,
      },
      routing: routing.action,
      duplicateCheck: {
        checked: !duplicateCheck.skipped,
        imageHash: duplicateCheck.imageHash,
      },
      digitalDocId,
      wasResized: imageData.wasResized,
    }
  }
)
