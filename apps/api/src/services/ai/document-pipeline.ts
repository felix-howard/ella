/**
 * AI Document Processing Pipeline
 * Orchestrates classification, blur detection, and OCR extraction
 */
import { classifyDocument, requiresOcrExtraction } from './document-classifier'
import { detectBlur, shouldRequestResend, getResendMessage } from './blur-detector'
import { extractDocumentData, needsManualVerification } from './ocr-extractor'
import { isGeminiConfigured } from './gemini-client'
import {
  updateRawImageStatus,
  getRawImageCaseId,
  markImageProcessing,
  linkToChecklistItem,
  createAction,
  markImageUnclassified,
  processOcrResultAtomic,
} from './pipeline-helpers'
import { notifyBlurryDocument } from '../sms'
import type { PipelineResult, BatchImageInput } from './pipeline-types'
import { DEFAULT_PIPELINE_CONFIG } from './pipeline-types'
import type { DocType } from '@ella/db'

// Default config
const config = DEFAULT_PIPELINE_CONFIG

/** Sleep utility */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Execute with retry logic for transient failures */
async function withRetry<T>(fn: () => Promise<T>, retries = config.maxRetries): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const isRetryable = /rate.?limit|timeout|503|500|502|overloaded/i.test(lastError.message)
      if (isRetryable && attempt < retries) {
        const delay = config.retryDelayMs * Math.pow(2, attempt)
        console.warn(`Pipeline retry ${attempt + 1}/${retries}, waiting ${delay}ms`)
        await sleep(delay)
      } else {
        throw lastError
      }
    }
  }
  throw lastError
}

/**
 * Process a single image through the AI pipeline
 * Steps: 1. Classify → 2. Detect blur → 3. Extract OCR (if applicable)
 */
export async function processImage(
  rawImageId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<PipelineResult> {
  const startTime = Date.now()
  const actionsCreated: string[] = []

  // Check if AI is configured
  if (!isGeminiConfigured) {
    return {
      rawImageId,
      success: false,
      actionsCreated: [],
      error: 'AI service not configured (GEMINI_API_KEY missing)',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Get case ID
  const caseId = await getRawImageCaseId(rawImageId)
  if (!caseId) {
    return {
      rawImageId,
      success: false,
      actionsCreated: [],
      error: 'Raw image not found',
      processingTimeMs: Date.now() - startTime,
    }
  }

  try {
    await markImageProcessing(rawImageId)

    // Step 1: Classify document (with retry)
    const classResult = await withRetry(() => classifyDocument(imageBuffer, mimeType))

    if (!classResult.success) {
      await updateRawImageStatus(rawImageId, 'UNCLASSIFIED', classResult.confidence)
      const actionId = await createAction({
        caseId,
        type: 'AI_FAILED',
        priority: 'HIGH',
        title: 'AI phân loại thất bại',
        description: `Không thể phân loại tài liệu: ${classResult.error}`,
        metadata: { rawImageId },
      })
      actionsCreated.push(actionId)

      return {
        rawImageId,
        success: false,
        classification: { docType: 'UNKNOWN', confidence: 0 },
        actionsCreated,
        error: classResult.error,
        processingTimeMs: Date.now() - startTime,
      }
    }

    const docType = classResult.docType as DocType

    // Step 2: Detect blur (with retry)
    const blurResult = await withRetry(() => detectBlur(imageBuffer, mimeType))
    const needsResend = shouldRequestResend(blurResult)

    if (needsResend) {
      await updateRawImageStatus(rawImageId, 'BLURRY', classResult.confidence, docType)
      const actionId = await createAction({
        caseId,
        type: 'BLURRY_DETECTED',
        priority: 'HIGH',
        title: 'Ảnh bị mờ - cần chụp lại',
        description: getResendMessage(blurResult),
        metadata: { rawImageId, docType, blurScore: blurResult.blurScore },
      })
      actionsCreated.push(actionId)

      // Auto-send blurry resend SMS (non-blocking, fire-and-forget)
      notifyBlurryDocument(caseId, [docType]).catch((err) => {
        console.error('[Pipeline] Failed to send blurry SMS notification:', err)
      })

      return {
        rawImageId,
        success: true,
        classification: { docType, confidence: classResult.confidence },
        blurDetection: {
          isBlurry: true,
          blurScore: blurResult.blurScore,
          needsResend: true,
          message: getResendMessage(blurResult),
        },
        actionsCreated,
        processingTimeMs: Date.now() - startTime,
      }
    }

    // Update classification and link to checklist
    await updateRawImageStatus(rawImageId, 'CLASSIFIED', classResult.confidence, docType)
    const checklistItemId = await linkToChecklistItem(rawImageId, caseId, docType)

    // Step 3: OCR extraction (if doc type supports it)
    let ocrResult = null
    let digitalDocId: string | undefined

    if (requiresOcrExtraction(docType)) {
      ocrResult = await withRetry(() => extractDocumentData(imageBuffer, mimeType, docType))

      const status = ocrResult.success
        ? (ocrResult.isValid ? 'EXTRACTED' : 'PARTIAL')
        : 'FAILED'

      // Atomic transaction: upsert digital doc, update checklist, mark image linked
      digitalDocId = await processOcrResultAtomic({
        rawImageId,
        caseId,
        docType,
        extractedData: ocrResult.extractedData || {},
        status: status as 'EXTRACTED' | 'PARTIAL' | 'FAILED',
        confidence: ocrResult.confidence,
        checklistItemId,
      })

      // Create verification action (outside transaction - non-critical)
      if (needsManualVerification(ocrResult)) {
        const actionId = await createAction({
          caseId,
          type: 'VERIFY_DOCS',
          priority: 'NORMAL',
          title: 'Xác minh dữ liệu OCR',
          description: `${docType}: Dữ liệu cần xác minh (độ tin cậy: ${Math.round(ocrResult.confidence * 100)}%)`,
          metadata: { rawImageId, digitalDocId, docType, confidence: ocrResult.confidence },
        })
        actionsCreated.push(actionId)
      }
    }

    return {
      rawImageId,
      success: true,
      classification: { docType, confidence: classResult.confidence },
      blurDetection: {
        isBlurry: false,
        blurScore: blurResult.blurScore,
        needsResend: false,
      },
      ocrExtraction: ocrResult
        ? {
            success: ocrResult.success,
            hasData: ocrResult.extractedData !== null,
            confidence: ocrResult.confidence,
          }
        : undefined,
      digitalDocId,
      actionsCreated,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markImageUnclassified(rawImageId)

    const actionId = await createAction({
      caseId,
      type: 'AI_FAILED',
      priority: 'HIGH',
      title: 'Lỗi xử lý AI',
      description: errorMessage,
      metadata: { rawImageId },
    })
    actionsCreated.push(actionId)

    return {
      rawImageId,
      success: false,
      actionsCreated,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Process multiple images with controlled concurrency
 */
export async function processImageBatch(
  images: BatchImageInput[],
  concurrency = config.batchConcurrency
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []

  // Process in chunks with controlled concurrency
  for (let i = 0; i < images.length; i += concurrency) {
    const chunk = images.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map((img) => processImage(img.id, img.buffer, img.mimeType))
    )
    results.push(...chunkResults)
  }

  return results
}

/**
 * Get pipeline status for monitoring
 */
export function getPipelineStatus() {
  return {
    aiConfigured: isGeminiConfigured,
    supportedDocTypes: ['W2', 'FORM_1099_INT', 'FORM_1099_NEC', 'SSN_CARD', 'DRIVER_LICENSE'],
    config,
  }
}
