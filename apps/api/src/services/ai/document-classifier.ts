/**
 * Document Classifier Service
 * Classifies uploaded images into document types using Gemini vision
 */
import { analyzeImage, isGeminiConfigured } from './gemini-client'
import { getClassificationPrompt, validateClassificationResult } from './prompts/classify'
import type { ClassificationResult, SupportedDocType } from './prompts/classify'
import { config } from '../../lib/config'

/**
 * Classification result with additional metadata
 */
export interface DocumentClassificationResult {
  success: boolean
  docType: SupportedDocType | 'UNKNOWN'
  confidence: number
  reasoning: string
  alternativeTypes?: Array<{
    docType: SupportedDocType
    confidence: number
  }>
  error?: string
  processingTimeMs?: number
}

/**
 * Classify a document image
 *
 * @param imageBuffer - The image file buffer
 * @param mimeType - MIME type of the image (image/jpeg, image/png, etc.)
 * @returns Classification result with document type and confidence
 */
export async function classifyDocument(
  imageBuffer: Buffer,
  mimeType: string
): Promise<DocumentClassificationResult> {
  const startTime = Date.now()

  // Check if Gemini is configured
  if (!isGeminiConfigured) {
    return {
      success: false,
      docType: 'UNKNOWN',
      confidence: 0,
      reasoning: 'AI service not configured',
      error: 'Gemini API key not configured',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Validate mime type (images + PDF supported by Gemini 2.0)
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf', // Gemini 2.0 Flash supports PDFs directly
  ]
  if (!supportedTypes.includes(mimeType)) {
    return {
      success: false,
      docType: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Unsupported file format',
      error: `Unsupported MIME type: ${mimeType}`,
      processingTimeMs: Date.now() - startTime,
    }
  }

  try {
    const prompt = getClassificationPrompt()
    const result = await analyzeImage<ClassificationResult>(imageBuffer, mimeType, prompt)

    if (!result.success || !result.data) {
      return {
        success: false,
        docType: 'UNKNOWN',
        confidence: 0,
        reasoning: 'AI classification failed',
        error: result.error || 'Unknown error during classification',
        processingTimeMs: Date.now() - startTime,
      }
    }

    // Validate the response structure
    if (!validateClassificationResult(result.data)) {
      return {
        success: false,
        docType: 'UNKNOWN',
        confidence: 0,
        reasoning: 'Invalid AI response structure',
        error: 'AI returned invalid classification format',
        processingTimeMs: Date.now() - startTime,
      }
    }

    return {
      success: true,
      docType: result.data.docType,
      confidence: result.data.confidence,
      reasoning: result.data.reasoning,
      alternativeTypes: result.data.alternativeTypes,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      docType: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Classification error occurred',
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Batch classify multiple documents
 * Processes documents in parallel with concurrency limit
 *
 * @param images - Array of images to classify
 * @param concurrency - Max concurrent classifications (defaults to config.ai.batchConcurrency)
 * @returns Array of classification results
 */
export async function batchClassifyDocuments(
  images: Array<{ buffer: Buffer; mimeType: string; id: string }>,
  concurrency = config.ai.batchConcurrency
): Promise<Array<{ id: string; result: DocumentClassificationResult }>> {
  const results: Array<{ id: string; result: DocumentClassificationResult }> = []

  // Process in chunks to limit concurrency
  for (let i = 0; i < images.length; i += concurrency) {
    const chunk = images.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map(async (img) => ({
        id: img.id,
        result: await classifyDocument(img.buffer, img.mimeType),
      }))
    )
    results.push(...chunkResults)
  }

  return results
}

/**
 * Check if a document type needs OCR extraction
 */
export function requiresOcrExtraction(docType: SupportedDocType | 'UNKNOWN'): boolean {
  const ocrTypes: Array<SupportedDocType | 'UNKNOWN'> = [
    'W2',
    'FORM_1099_INT',
    'FORM_1099_DIV',
    'FORM_1099_NEC',
    'FORM_1099_MISC',
    'FORM_1099_K',
    'FORM_1099_R',
    'FORM_1099_G',
    'FORM_1099_SSA',
    'SSN_CARD',
    'DRIVER_LICENSE',
    'FORM_1098',
    'FORM_1098_T',
  ]
  return ocrTypes.includes(docType)
}

/**
 * Get human-readable label for document type (Vietnamese)
 */
export function getDocTypeLabel(docType: SupportedDocType | 'UNKNOWN'): string {
  const labels: Record<SupportedDocType | 'UNKNOWN', string> = {
    SSN_CARD: 'Thẻ SSN',
    DRIVER_LICENSE: 'Bằng Lái / ID',
    PASSPORT: 'Hộ chiếu',
    W2: 'W2 (Thu nhập từ công việc)',
    FORM_1099_INT: '1099-INT (Lãi ngân hàng)',
    FORM_1099_DIV: '1099-DIV (Cổ tức)',
    FORM_1099_NEC: '1099-NEC (Thu nhập tự do)',
    FORM_1099_MISC: '1099-MISC',
    FORM_1099_K: '1099-K (Thu nhập thẻ)',
    FORM_1099_R: '1099-R (Tiền hưu)',
    FORM_1099_G: '1099-G (Thanh toán chính phủ)',
    FORM_1099_SSA: '1099-SSA (An sinh xã hội)',
    BANK_STATEMENT: 'Sao kê ngân hàng',
    PROFIT_LOSS_STATEMENT: 'Báo cáo lời lỗ',
    BUSINESS_LICENSE: 'Giấy phép kinh doanh',
    EIN_LETTER: 'Thư EIN',
    FORM_1098: '1098 (Lãi vay nhà)',
    FORM_1098_T: '1098-T (Học phí)',
    RECEIPT: 'Hóa đơn / Biên lai',
    BIRTH_CERTIFICATE: 'Giấy khai sinh',
    DAYCARE_RECEIPT: 'Hóa đơn daycare',
    OTHER: 'Khác',
    UNKNOWN: 'Chưa xác định',
  }
  return labels[docType] || 'Chưa xác định'
}
