/**
 * OCR Extractor Service
 * Extracts structured data from documents using Gemini vision
 * Supports both images and PDFs (native Gemini PDF support)
 */
import { analyzeImage, isGeminiConfigured } from './gemini-client'
import {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
} from './prompts/ocr'
import { isPdfMimeType } from '../pdf'

// OCR constants
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const SUPPORTED_MIME_TYPES = [...SUPPORTED_IMAGE_TYPES, 'application/pdf']
const MAX_CONFIDENCE = 0.99 // Cap confidence to never show 100% for AI extraction

/**
 * OCR extraction result (supports multi-page PDFs)
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
  // Multi-page support
  pageCount?: number
  pageConfidences?: number[]
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

  // Validate mime type (now includes PDF)
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
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
    // Route to PDF or image extraction
    if (isPdfMimeType(mimeType)) {
      return await extractFromPdf(imageBuffer, docType, prompt, startTime)
    }

    // Image extraction (existing logic)
    return await extractFromImage(imageBuffer, mimeType, docType, prompt, startTime)
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
 * Extract data from single image using Gemini OCR
 */
async function extractFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  docType: string,
  prompt: string,
  startTime: number
): Promise<OcrExtractionResult> {
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

  const isValid = validateExtractedData(docType, result.data)
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
}

/**
 * Extract data from PDF document
 * Uses Gemini's native PDF support (no image conversion needed)
 * Gemini 2.0/2.5 can read PDFs directly with better accuracy
 */
async function extractFromPdf(
  pdfBuffer: Buffer,
  docType: string,
  prompt: string,
  startTime: number
): Promise<OcrExtractionResult> {
  // Send PDF directly to Gemini - it supports native PDF reading
  // This is more accurate than converting to images
  const result = await analyzeImage<Record<string, unknown>>(
    pdfBuffer,
    'application/pdf',
    prompt
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      docType,
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: getFieldLabels(docType),
      error: result.error || 'PDF extraction failed',
      processingTimeMs: Date.now() - startTime,
    }
  }

  const isValid = validateExtractedData(docType, result.data)
  const confidence = calculateConfidence(result.data, docType)

  return {
    success: true,
    docType,
    extractedData: result.data,
    confidence,
    isValid,
    fieldLabels: getFieldLabels(docType),
    pageCount: 1, // Gemini processes entire PDF at once
    processingTimeMs: Date.now() - startTime,
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
    FORM_1099_K: ['filerName', 'payeeTIN', 'grossAmount'],
    FORM_1099_DIV: ['payerName', 'recipientTIN', 'totalOrdinaryDividends'],
    FORM_1099_R: ['payerName', 'recipientTIN', 'grossDistribution'],
    FORM_1099_SSA: ['recipientName', 'recipientSSN', 'totalBenefits'],
    FORM_1099_G: ['payerName', 'recipientTIN', 'unemploymentCompensation'],
    FORM_1099_MISC: ['payerName', 'recipientTIN'],
    FORM_1098: ['lenderName', 'borrowerTIN', 'mortgageInterestReceived'],
    FORM_1098_T: ['filerName', 'studentTIN', 'paymentsReceived'],
    FORM_1095_A: ['marketplaceName', 'recipientSSN', 'monthlyPremium'],
    SCHEDULE_K1: ['partnershipName', 'partnerSSN', 'ordinaryBusinessIncome', 'selfEmploymentEarnings'],
    BANK_STATEMENT: ['bankName', 'accountNumber', 'beginningBalance', 'endingBalance'],
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

  return Math.min(keyFieldConfidence + completenessBonus, MAX_CONFIDENCE)
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
