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
 * 6. Rename file with naming convention (classified docs only)
 * 7. OCR extraction (if confidence >= 60% and doc type supports OCR)
 * 8. Update DB with results
 */

import sharp from 'sharp'
import { inngest } from '../lib/inngest'
import { prisma } from '../lib/db'
import { fetchImageBuffer, renameFile } from '../services/storage'
import { getCategoryFromDocType, getDisplayNameFromKey } from '@ella/shared'
import { classifyDocument, requiresOcrExtraction, generateSmartFilename } from '../services/ai'
// Simple PDF check (pdf-poppler removed)
const isPdfMimeType = (mimeType: string) => mimeType === 'application/pdf'
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
import type { DocType, DocCategory } from '@ella/db'

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

/**
 * Sync renamed R2 key to Message attachments (M3: atomic update, M4: DRY)
 * Uses single atomic updateMany query instead of loop for race condition safety
 */
async function syncMessageR2Keys(oldKey: string, newKey: string): Promise<number> {
  try {
    // Find messages with old key and update atomically
    const messagesWithOldKey = await prisma.message.findMany({
      where: { attachmentR2Keys: { has: oldKey } },
      select: { id: true, attachmentR2Keys: true },
    })

    if (messagesWithOldKey.length === 0) return 0

    // Use Promise.all for parallel updates (safe since each message is independent)
    await Promise.all(
      messagesWithOldKey.map((msg) =>
        prisma.message.update({
          where: { id: msg.id },
          data: {
            attachmentR2Keys: msg.attachmentR2Keys.map((k) => (k === oldKey ? newKey : k)),
          },
        })
      )
    )

    console.log(`[classify-document] Updated ${messagesWithOldKey.length} message(s) with renamed R2 key`)
    return messagesWithOldKey.length
  } catch (syncErr) {
    console.warn(`[classify-document] Failed to sync renamed key to messages:`, syncErr)
    return 0
  }
}

export const classifyDocumentJob = inngest.createFunction(
  {
    id: 'classify-document',
    retries: 3,
    throttle: { limit: 10, period: '1m' }, // Gemini rate limit protection
    onFailure: async ({ event, error }) => {
      // When all retries exhausted, move document to OTHER category instead of stuck in PROCESSING
      const { rawImageId, caseId, r2Key } = event.data.event.data

      console.error(`[classify-document] All retries exhausted for ${rawImageId}:`, error.message)

      try {
        // Update status to CLASSIFIED with OTHER classifiedType
        await prisma.rawImage.update({
          where: { id: rawImageId },
          data: {
            status: 'CLASSIFIED',
            classifiedType: 'OTHER',
            category: 'OTHER',
            aiConfidence: 0,
          },
        })

        // Create action for CPA visibility
        const errorInfo = getVietnameseError(error.message)
        await createAction({
          caseId,
          type: 'AI_FAILED',
          priority: getActionPriority(errorInfo.severity),
          title: 'AI xử lý thất bại sau nhiều lần thử',
          description: errorInfo.message,
          metadata: {
            rawImageId,
            r2Key,
            errorType: errorInfo.type,
            technicalError: sanitizeErrorMessage(error.message + ' (retries exhausted)'),
            attemptedAt: new Date().toISOString(),
          },
        })

        console.log(`[classify-document] Moved ${rawImageId} to OTHER category after retry exhaustion`)
      } catch (dbError) {
        console.error(`[classify-document] Failed to update ${rawImageId} on failure:`, dbError)
      }
    },
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
    // NOTE: Buffer stored outside step to avoid Inngest step output size limit (~4MB).
    // Inngest serializes step results; large base64 buffers exceed this limit.
    let fileBuffer: Buffer | null = null

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

      if (isPdf) {
        console.log(`[classify-document] Using native PDF reading (no conversion)`)
      }

      // Store buffer outside step output to avoid Inngest serialization size limit
      fileBuffer = buffer

      // Only return lightweight metadata (no buffer) to stay under Inngest step output limit
      return {
        mimeType,
        wasResized,
        isPdf,
      }
    })

    // On Inngest replay (retry after later step failure), fetch-image won't re-execute
    // so fileBuffer will be null. Re-fetch the buffer in that case.
    // Note: the rename step may have moved the file to a new R2 key, so try DB lookup if original key fails.
    if (!fileBuffer) {
      let refetch = await fetchImageBuffer(r2Key)
      if (!refetch) {
        // Original key may have been renamed -- look up current key from DB
        const current = await prisma.rawImage.findUnique({
          where: { id: rawImageId },
          select: { r2Key: true },
        })
        if (current && current.r2Key !== r2Key) {
          refetch = await fetchImageBuffer(current.r2Key)
        }
        if (!refetch) throw new Error(`Failed to re-fetch file from R2: ${r2Key}`)
      }
      let buffer = refetch.buffer
      if (!imageData.isPdf && buffer.length > MAX_IMAGE_SIZE) {
        buffer = await sharp(buffer)
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
      }
      fileBuffer = buffer
    }

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
        const buffer = fileBuffer!
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

    // Handle duplicate - still need meaningful displayName before returning
    if (duplicateCheck.isDuplicate) {
      // Check if original has displayName - if not, run smart rename
      const originalImage = duplicateCheck.matchedImageId
        ? await prisma.rawImage.findUnique({
            where: { id: duplicateCheck.matchedImageId },
            select: { displayName: true, classifiedType: true, category: true },
          })
        : null

      // If original has no displayName, generate one via smart rename
      if (!originalImage?.displayName) {
        const buffer = fileBuffer!
        const smartRename = await generateSmartFilename(buffer, imageData.mimeType)

        if (smartRename && smartRename.suggestedFilename) {
          // Use smart rename for this duplicate
          await prisma.rawImage.update({
            where: { id: rawImageId },
            data: {
              displayName: `${smartRename.suggestedFilename} (Duplicate)`,
              category: 'OTHER',
            },
          })
          console.log(`[classify-document] Duplicate smart-renamed: ${smartRename.suggestedFilename}`)
        }
      }
      // Note: markImageDuplicate already copies displayName from original if it exists

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
      const buffer = fileBuffer!

      try {
        const result = await classifyDocument(buffer, imageData.mimeType)

        // Check for service unavailability in error message
        if (!result.success && result.error && isServiceUnavailable(result.error)) {
          const errorInfo = getVietnameseError(result.error)

          // Put in OTHER category (not unclassified) and create action
          await updateRawImageStatus(rawImageId, 'CLASSIFIED', 0, 'OTHER' as DocType)
          await prisma.rawImage.update({
            where: { id: rawImageId },
            data: { category: 'OTHER' },
          })
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
          taxYear: result.taxYear,
          source: result.source,
          recipientName: result.recipientName,
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
          taxYear: null,
          source: null,
          recipientName: null,
        }
      }
    })

    // Step 3: Route by confidence and update DB
    // Also handles fallback smart rename for low confidence documents
    interface RoutingResult {
      action: string
      needsOcr: boolean
      checklistItemId: string | null
      smartRename?: {
        suggestedFilename: string
        documentTitle: string
        pageInfo: unknown
        reasoning: string
      }
    }

    const routing = await step.run('route-by-confidence', async (): Promise<RoutingResult> => {
      const { confidence, docType, success, error } = classification

      // Failed classification or very low confidence → try smart rename first
      if (!success || confidence < LOW_CONFIDENCE) {
        // Try fallback smart rename before giving up
        const buffer = fileBuffer!
        const smartRename = await generateSmartFilename(buffer, imageData.mimeType)

        if (smartRename && smartRename.confidence >= LOW_CONFIDENCE) {
          // Smart rename succeeded - use AI-generated name
          // Cast pageInfo to plain object for Prisma JSON compatibility
          const aiMetadata = {
            documentTitle: smartRename.documentTitle,
            pageInfo: JSON.parse(JSON.stringify(smartRename.pageInfo)),
            fallbackRename: true,
            reasoning: smartRename.reasoning,
            originalClassificationConfidence: confidence,
          }

          await prisma.rawImage.update({
            where: { id: rawImageId },
            data: {
              status: 'CLASSIFIED',
              classifiedType: 'OTHER',
              category: 'OTHER',
              displayName: smartRename.suggestedFilename,
              aiConfidence: smartRename.confidence,
              aiMetadata,
            },
          })

          console.log(`[classify-document] Smart rename succeeded: ${smartRename.suggestedFilename}`)

          return {
            action: 'fallback-renamed',
            needsOcr: false,
            checklistItemId: null,
            smartRename: {
              suggestedFilename: smartRename.suggestedFilename,
              documentTitle: smartRename.documentTitle,
              pageInfo: smartRename.pageInfo,
              reasoning: smartRename.reasoning,
            },
          }
        }

        // Smart rename failed or low confidence - fall back to existing behavior
        const errorInfo = getVietnameseError(error || classification.reasoning)

        // Set to CLASSIFIED with OTHER docType - goes directly to "Khác" category
        await updateRawImageStatus(rawImageId, 'CLASSIFIED', confidence, 'OTHER' as DocType)

        // Still create AI_FAILED action for CPA visibility
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
            smartRenameFailed: smartRename ? false : true,
            smartRenameConfidence: smartRename?.confidence,
          },
        })

        return { action: 'ai-failed-to-other', needsOcr: false, checklistItemId: null }
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

    // Step 4: Rename file with naming convention (only for classified docs)
    interface RenameStepResult {
      renamed: boolean
      newKey: string | null
      displayName: string | null
      category: DocCategory | null
      error?: string
    }

    const renameResult = await step.run('rename-file', async (): Promise<RenameStepResult> => {
      // For AI-failed docs, skip rename but set category to OTHER
      if (routing.action === 'ai-failed-to-other') {
        await prisma.rawImage.update({
          where: { id: rawImageId },
          data: { category: 'OTHER' },
        })
        return {
          renamed: false,
          newKey: null,
          displayName: null,
          category: 'OTHER',
        }
      }

      // For fallback-renamed docs, rename using smart rename data
      if (routing.action === 'fallback-renamed' && routing.smartRename) {
        // Defense-in-depth: Validate caseId format (CUID)
        if (!caseId || !/^c[a-z0-9]{24,}$/.test(caseId)) {
          console.error(`[classify-document] Invalid caseId format: ${caseId}`)
          return {
            renamed: false,
            newKey: null,
            displayName: routing.smartRename.suggestedFilename,
            category: 'OTHER',
            error: 'INVALID_CASE_ID',
          }
        }

        // Rename using smart rename documentTitle as docType
        const result = await renameFile(r2Key, caseId, {
          taxYear: null, // Smart rename includes year in suggestedFilename
          docType: routing.smartRename.documentTitle,
          source: null,
          recipientName: null,
        })

        if (!result.success) {
          console.error(`[classify-document] Smart rename file failed`, {
            rawImageId,
            r2Key,
            suggestedFilename: routing.smartRename.suggestedFilename,
            error: result.error,
          })
          // displayName already set in route-by-confidence, just return
          return {
            renamed: false,
            newKey: null,
            displayName: routing.smartRename.suggestedFilename,
            category: 'OTHER',
            error: result.error,
          }
        }

        // Update DB with new key (displayName already set in route-by-confidence)
        await prisma.rawImage.update({
          where: { id: rawImageId },
          data: { r2Key: result.newKey },
        })

        // Sync renamed key to Message attachments (M3/M4: use shared helper)
        await syncMessageR2Keys(r2Key, result.newKey)

        console.log(`[classify-document] Smart renamed: ${r2Key} -> ${result.newKey}`)

        return {
          renamed: true,
          newKey: result.newKey,
          displayName: routing.smartRename.suggestedFilename,
          category: 'OTHER',
        }
      }

      // Skip rename for other non-success cases
      if (!classification.success) {
        return {
          renamed: false,
          newKey: null,
          displayName: null,
          category: null,
        }
      }

      // Defense-in-depth: Validate caseId format (CUID)
      if (!caseId || !/^c[a-z0-9]{24,}$/.test(caseId)) {
        console.error(`[classify-document] Invalid caseId format: ${caseId}`)
        return {
          renamed: false,
          newKey: null,
          displayName: null,
          category: null,
          error: 'INVALID_CASE_ID',
        }
      }

      const validDocType = classification.docType as DocType
      // TypeScript exhaustiveness: getCategoryFromDocType handles all DocType values
      // Returns 'OTHER' for unknown types as fallback
      const category = getCategoryFromDocType(validDocType)

      // Call rename service (uses copy-delete pattern for atomic rename)
      // Race condition safety: Copy completes first, then DB update, then delete
      // If any step fails, retry is safe because copy is idempotent
      // recipientName is extracted from document by AI (employee name, recipient, etc.)
      const result = await renameFile(r2Key, caseId, {
        taxYear: classification.taxYear,
        docType: validDocType,
        source: classification.source,
        recipientName: classification.recipientName,
      })

      if (!result.success) {
        // Telemetry: Log rename failure with context for debugging
        console.error(`[classify-document] Rename failed`, {
          rawImageId,
          caseId,
          r2Key,
          docType: validDocType,
          error: result.error,
          timestamp: new Date().toISOString(),
        })
        // Don't fail job - continue with old key, category still set
        return {
          renamed: false,
          newKey: null,
          displayName: null,
          category,
          error: result.error,
        }
      }

      // Update DB with new key + metadata
      const displayName = getDisplayNameFromKey(result.newKey)

      await prisma.rawImage.update({
        where: { id: rawImageId },
        data: {
          r2Key: result.newKey,
          displayName,
          category,
        },
      })

      // Sync renamed key to any Message that references the old key
      // This prevents the media proxy from returning 500 for renamed files
      // Sync renamed key to Message attachments (M3/M4: use shared helper)
      await syncMessageR2Keys(r2Key, result.newKey)

      console.log(`[classify-document] Renamed: ${r2Key} -> ${result.newKey}`)

      return {
        renamed: true,
        newKey: result.newKey,
        displayName,
        category,
      }
    })

    // Step 5: OCR extraction (only if confidence >= 60% and doc type supports OCR)
    // Gemini 2.5 reads PDFs directly for better accuracy
    let digitalDocId: string | undefined
    if (routing.needsOcr) {
      digitalDocId = await step.run('ocr-extract', async () => {
        const buffer = fileBuffer!
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

    // NOTE: Multi-page detection moved to manual trigger via POST /cases/:caseId/group-documents
    // Auto-trigger removed to prevent race conditions during bulk uploads
    // See: plans/260224-2044-manual-document-grouping/phase-01-remove-auto-trigger.md

    // Return final result
    return {
      rawImageId,
      classification: {
        docType: classification.docType,
        confidence: classification.confidence,
      },
      routing: routing.action,
      rename: {
        renamed: renameResult.renamed,
        newKey: renameResult.newKey,
        displayName: renameResult.displayName,
        category: renameResult.category,
      },
      duplicateCheck: {
        checked: !duplicateCheck.skipped,
        imageHash: duplicateCheck.imageHash,
      },
      digitalDocId,
      wasResized: imageData.wasResized,
    }
  }
)
