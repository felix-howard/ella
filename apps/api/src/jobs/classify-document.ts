/**
 * Document Classification Job
 * Background job for AI-powered document classification using Gemini
 *
 * Workflow:
 * 1. Fetch image from R2
 * 2. Classify with Gemini
 * 3. Route by confidence (>85% auto-link, 60-85% review, <60% unclassified)
 * 4. Detect duplicates using pHash and group similar images
 * 5. OCR extraction (if confidence >= 60% and doc type supports OCR)
 * 6. Update DB with results
 */

import { inngest } from '../lib/inngest'
import { fetchImageBuffer } from '../services/storage'
import { classifyDocument, requiresOcrExtraction } from '../services/ai'
import { extractDocumentData } from '../services/ai/ocr-extractor'
import {
  updateRawImageStatus,
  linkToChecklistItem,
  createAction,
  processOcrResultAtomic,
  markImageProcessing,
} from '../services/ai/pipeline-helpers'
import { generateImageHash, assignToImageGroup } from '../services/ai/duplicate-detector'
import type { DocType } from '@ella/db'

// Confidence thresholds from plan
const HIGH_CONFIDENCE = 0.85
const LOW_CONFIDENCE = 0.60

export const classifyDocumentJob = inngest.createFunction(
  {
    id: 'classify-document',
    retries: 3,
    throttle: { limit: 10, period: '1m' }, // Gemini rate limit protection
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { rawImageId, caseId, r2Key, mimeType: eventMimeType } = event.data

    // Mark image as processing
    await step.run('mark-processing', async () => {
      await markImageProcessing(rawImageId)
    })

    // Step 1: Fetch image from R2
    const imageData = await step.run('fetch-image', async () => {
      const result = await fetchImageBuffer(r2Key)
      if (!result) {
        throw new Error(`Failed to fetch image from R2: ${r2Key}`)
      }
      // Store as base64 for step durability (Inngest serializes step results)
      // Use R2 content-type or fallback to event mimeType
      return {
        buffer: result.buffer.toString('base64'),
        mimeType: result.mimeType || eventMimeType,
      }
    })

    // Step 2: Classify with Gemini
    const classification = await step.run('classify', async () => {
      const buffer = Buffer.from(imageData.buffer, 'base64')
      const result = await classifyDocument(buffer, imageData.mimeType)

      return {
        success: result.success,
        docType: result.docType,
        confidence: result.confidence,
        reasoning: result.reasoning,
      }
    })

    // Step 3: Route by confidence and update DB
    const routing = await step.run('route-by-confidence', async () => {
      const { confidence, docType, success } = classification

      // Failed classification or very low confidence → unclassified
      if (!success || confidence < LOW_CONFIDENCE) {
        await updateRawImageStatus(rawImageId, 'UNCLASSIFIED', confidence)

        // Create AI_FAILED action for CPA visibility
        await createAction({
          caseId,
          type: 'AI_FAILED',
          priority: 'NORMAL',
          title: 'Phân loại tự động thất bại',
          description: `Không thể phân loại tài liệu (độ tin cậy: ${Math.round(confidence * 100)}%)`,
          metadata: {
            rawImageId,
            errorMessage: classification.reasoning,
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

    // Step 4: Detect duplicates and group similar images
    const grouping = await step.run('detect-duplicates', async () => {
      // Skip grouping for unclassified images
      if (routing.action === 'unclassified') {
        return { grouped: false, groupId: null, imageCount: 1 }
      }

      const buffer = Buffer.from(imageData.buffer, 'base64')
      const imageHash = await generateImageHash(buffer)
      const validDocType = classification.docType as DocType

      const result = await assignToImageGroup(
        rawImageId,
        caseId,
        validDocType,
        imageHash
      )

      return {
        grouped: result.groupId !== '',
        groupId: result.groupId || null,
        isNewGroup: result.isNew,
        imageCount: result.imageCount,
      }
    })

    // Step 5: OCR extraction (only if confidence >= 60% and doc type supports OCR)
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
      grouping: {
        grouped: grouping.grouped,
        groupId: grouping.groupId,
        imageCount: grouping.imageCount,
      },
      digitalDocId,
    }
  }
)
