/**
 * OCR Extractor Service
 * Extracts structured data from documents using Gemini vision
 */
import { analyzeImage, isGeminiConfigured } from './gemini-client'
import {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
} from './prompts/ocr'

/**
 * OCR extraction result
 */
export interface OcrExtractionResult {
  success: boolean
  docType: string
  extractedData: Record<string, unknown> | null
  confidence: number
  isValid: boolean
  fieldLabels: Record<string, string>
  error?: string
  processingTimeMs?: number
}

/**
 * Extract data from a document image using OCR
 *
 * @param imageBuffer - The image file buffer
 * @param mimeType - MIME type of the image
 * @param docType - The document type (must support OCR)
 * @returns Extraction result with structured data
 */
export async function extractDocumentData(
  imageBuffer: Buffer,
  mimeType: string,
  docType: string
): Promise<OcrExtractionResult> {
  const startTime = Date.now()

  // Check if Gemini is configured
  if (!isGeminiConfigured) {
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: 'Gemini API key not configured',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Validate doc type supports OCR
  if (!supportsOcrExtraction(docType)) {
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: `Document type ${docType} does not support OCR extraction`,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Get the prompt for this document type
  const prompt = getOcrPromptForDocType(docType)
  if (!prompt) {
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: `No OCR prompt available for ${docType}`,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Validate mime type
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (!supportedTypes.includes(mimeType)) {
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: `Unsupported MIME type: ${mimeType}`,
      processingTimeMs: Date.now() - startTime,
    }
  }

  try {
    // Call Gemini to extract data
    const result = await analyzeImage<Record<string, unknown>>(imageBuffer, mimeType, prompt)

    if (!result.success || !result.data) {
      return {
        success: false,
        docType,
        extractedData: null,
        confidence: 0,
        isValid: false,
        fieldLabels: getFieldLabels(docType),
        error: result.error || 'OCR extraction failed',
        processingTimeMs: Date.now() - startTime,
      }
    }

    // Validate the extracted data structure
    const isValid = validateExtractedData(docType, result.data)

    // Calculate confidence based on data completeness
    const confidence = calculateConfidence(result.data, docType)

    return {
      success: true,
      docType,
      extractedData: result.data,
      confidence,
      isValid,
      fieldLabels: getFieldLabels(docType),
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: getFieldLabels(docType),
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(data: Record<string, unknown>, docType: string): number {
  // Key fields that must be present for each doc type
  const keyFieldsByType: Record<string, string[]> = {
    W2: ['employerName', 'employeeSSN', 'wagesTipsOther', 'federalIncomeTaxWithheld'],
    FORM_1099_INT: ['payerName', 'recipientTIN', 'interestIncome'],
    FORM_1099_NEC: ['payerName', 'recipientTIN', 'nonemployeeCompensation'],
    SSN_CARD: ['fullName', 'ssn'],
    DRIVER_LICENSE: ['fullName', 'licenseNumber', 'expirationDate'],
  }

  const keyFields = keyFieldsByType[docType] || []
  if (keyFields.length === 0) return 0.5 // Default for unknown types

  let filledCount = 0
  for (const field of keyFields) {
    const value = data[field]
    if (value !== null && value !== undefined && value !== '') {
      filledCount++
    }
  }

  // Base confidence from key fields (0.5-0.9)
  const keyFieldConfidence = 0.5 + (filledCount / keyFields.length) * 0.4

  // Additional confidence from total field completeness
  const totalFields = Object.keys(data).length
  const filledFields = Object.values(data).filter(
    (v) => v !== null && v !== undefined && v !== ''
  ).length
  const completenessBonus = totalFields > 0 ? (filledFields / totalFields) * 0.1 : 0

  return Math.min(keyFieldConfidence + completenessBonus, 0.99)
}

/**
 * Get OCR extraction status message in Vietnamese
 */
export function getExtractionStatusMessage(result: OcrExtractionResult): string {
  if (!result.success) {
    return `Lỗi trích xuất: ${result.error}`
  }

  if (!result.isValid) {
    return 'Dữ liệu trích xuất không hợp lệ, cần xác minh thủ công'
  }

  if (result.confidence >= 0.85) {
    return 'Trích xuất thành công với độ tin cậy cao'
  }

  if (result.confidence >= 0.7) {
    return 'Trích xuất thành công, một số trường có thể cần xác minh'
  }

  return 'Trích xuất một phần, cần xác minh nhiều trường'
}

/**
 * Determine if extracted data needs manual verification
 */
export function needsManualVerification(result: OcrExtractionResult): boolean {
  if (!result.success) return true
  if (!result.isValid) return true
  if (result.confidence < 0.85) return true
  return false
}
