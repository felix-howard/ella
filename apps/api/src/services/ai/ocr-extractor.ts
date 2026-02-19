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
  type Form1040ExtractedData,
  type Schedule1ExtractedData,
  type ScheduleCExtractedData,
  type ScheduleSEExtractedData,
} from './prompts/ocr'
// Simple PDF check (pdf-poppler removed - using native Gemini PDF support)
const isPdfMimeType = (mimeType: string) => mimeType === 'application/pdf'

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
    SCHEDULE_1: ['totalAdditionalIncome', 'totalAdjustments', 'businessIncome'],
    SCHEDULE_C: ['grossReceipts', 'netProfit', 'businessName', 'totalExpenses'],
    SCHEDULE_SE: ['selfEmploymentTax', 'netProfitScheduleC', 'deductionHalfSeTax'],
    SCHEDULE_D: ['netShortTermGainLoss', 'netLongTermGainLoss', 'totalCapitalGainLoss'],
    SCHEDULE_E: ['totalNetRentalIncome', 'totalScheduleEIncome', 'combinedIncome'],
    BANK_STATEMENT: ['bankName', 'accountNumber', 'beginningBalance', 'endingBalance'],
    SSN_CARD: ['fullName', 'ssn'],
    DRIVER_LICENSE: ['fullName', 'licenseNumber', 'expirationDate'],
    FORM_1040: ['adjustedGrossIncome', 'totalTax', 'taxableIncome', 'taxpayerSSN'],
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

/**
 * Enhanced result for Form 1040 with attached schedules
 * Combines main 1040 data with schedule-specific extractions
 */
export interface Form1040EnhancedResult {
  success: boolean
  mainForm: Form1040ExtractedData | null
  schedule1: Schedule1ExtractedData | null
  scheduleC: ScheduleCExtractedData | null
  scheduleSE: ScheduleSEExtractedData | null
  extractedAt: string
  totalConfidence: number
  processingTimeMs: number
  scheduleExtractionErrors: string[]
  warnings: string[]
  error?: string
}

/**
 * Extract Form 1040 with attached schedules using multi-pass OCR
 * Pass 1: Extract main Form 1040 and detect attached schedules
 * Pass 2: Extract each detected schedule in parallel
 * Final: Merge all data with cross-reference validation
 *
 * @param pdfBuffer - PDF file buffer
 * @param mimeType - MIME type (must be application/pdf or supported image)
 * @returns Enhanced result with main form and schedule data
 */
export async function extractForm1040WithSchedules(
  pdfBuffer: Buffer,
  mimeType: string
): Promise<Form1040EnhancedResult> {
  const startTime = Date.now()
  const scheduleErrors: string[] = []
  const warnings: string[] = []

  // Check if Gemini is configured
  if (!isGeminiConfigured) {
    return {
      success: false,
      mainForm: null,
      schedule1: null,
      scheduleC: null,
      scheduleSE: null,
      extractedAt: new Date().toISOString(),
      totalConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      scheduleExtractionErrors: [],
      warnings: [],
      error: 'Gemini API key not configured',
    }
  }

  // Pass 1: Extract main Form 1040
  const mainResult = await extractDocumentData(pdfBuffer, mimeType, 'FORM_1040')

  if (!mainResult.success || !mainResult.extractedData) {
    return {
      success: false,
      mainForm: null,
      schedule1: null,
      scheduleC: null,
      scheduleSE: null,
      extractedAt: new Date().toISOString(),
      totalConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      scheduleExtractionErrors: [],
      warnings: [],
      error: mainResult.error || 'Form 1040 extraction failed',
    }
  }

  const mainForm = mainResult.extractedData as unknown as Form1040ExtractedData
  const attachedSchedules = mainForm.attachedSchedules || []

  // Detect which schedules to extract
  const hasSchedule1 = attachedSchedules.includes('1')
  const hasScheduleC = attachedSchedules.includes('C')
  const hasScheduleSE = attachedSchedules.includes('SE')

  // Pass 2: Extract detected schedules in parallel
  const [sch1Result, schCResult, schSEResult] = await Promise.all([
    hasSchedule1
      ? extractDocumentData(pdfBuffer, mimeType, 'SCHEDULE_1').catch((err) => {
          scheduleErrors.push(`Schedule 1: ${err.message}`)
          return null
        })
      : Promise.resolve(null),
    hasScheduleC
      ? extractDocumentData(pdfBuffer, mimeType, 'SCHEDULE_C').catch((err) => {
          scheduleErrors.push(`Schedule C: ${err.message}`)
          return null
        })
      : Promise.resolve(null),
    hasScheduleSE
      ? extractDocumentData(pdfBuffer, mimeType, 'SCHEDULE_SE').catch((err) => {
          scheduleErrors.push(`Schedule SE: ${err.message}`)
          return null
        })
      : Promise.resolve(null),
  ])

  // Collect extraction errors from failed schedules
  if (sch1Result && !sch1Result.success && sch1Result.error) {
    scheduleErrors.push(`Schedule 1: ${sch1Result.error}`)
  }
  if (schCResult && !schCResult.success && schCResult.error) {
    scheduleErrors.push(`Schedule C: ${schCResult.error}`)
  }
  if (schSEResult && !schSEResult.success && schSEResult.error) {
    scheduleErrors.push(`Schedule SE: ${schSEResult.error}`)
  }

  // Extract schedule data (null if not present or failed)
  const schedule1 = sch1Result?.success
    ? (sch1Result.extractedData as unknown as Schedule1ExtractedData)
    : null
  const scheduleC = schCResult?.success
    ? (schCResult.extractedData as unknown as ScheduleCExtractedData)
    : null
  const scheduleSE = schSEResult?.success
    ? (schSEResult.extractedData as unknown as ScheduleSEExtractedData)
    : null

  // Cross-reference validation (warnings only, don't fail)
  validateCrossReferences(mainForm, schedule1, scheduleC, scheduleSE, warnings)

  // Calculate combined confidence
  const totalConfidence = calculateCombinedConfidence(
    mainResult,
    sch1Result,
    schCResult,
    schSEResult
  )

  return {
    success: true,
    mainForm,
    schedule1,
    scheduleC,
    scheduleSE,
    extractedAt: new Date().toISOString(),
    totalConfidence,
    processingTimeMs: Date.now() - startTime,
    scheduleExtractionErrors: scheduleErrors,
    warnings,
  }
}

/**
 * Calculate combined confidence score from all extraction results
 * Weights main form higher than schedules
 */
function calculateCombinedConfidence(
  mainResult: OcrExtractionResult,
  sch1Result: OcrExtractionResult | null,
  schCResult: OcrExtractionResult | null,
  schSEResult: OcrExtractionResult | null
): number {
  const weights: number[] = []
  const confidences: number[] = []

  // Main form has highest weight (0.5)
  if (mainResult.success) {
    weights.push(0.5)
    confidences.push(mainResult.confidence)
  }

  // Each schedule contributes ~0.17 if present
  const scheduleWeight = 0.5 / 3
  if (sch1Result?.success) {
    weights.push(scheduleWeight)
    confidences.push(sch1Result.confidence)
  }
  if (schCResult?.success) {
    weights.push(scheduleWeight)
    confidences.push(schCResult.confidence)
  }
  if (schSEResult?.success) {
    weights.push(scheduleWeight)
    confidences.push(schSEResult.confidence)
  }

  if (weights.length === 0) return 0

  // Normalize weights and calculate weighted average
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let weightedSum = 0
  for (let i = 0; i < weights.length; i++) {
    weightedSum += (weights[i] / totalWeight) * confidences[i]
  }

  return Math.min(weightedSum, MAX_CONFIDENCE)
}

/**
 * Validate cross-references between 1040 and schedules
 * Adds warnings for mismatches (doesn't fail extraction)
 */
function validateCrossReferences(
  mainForm: Form1040ExtractedData,
  schedule1: Schedule1ExtractedData | null,
  scheduleC: ScheduleCExtractedData | null,
  scheduleSE: ScheduleSEExtractedData | null,
  warnings: string[]
): void {
  // Check Schedule C netProfit matches Schedule 1 businessIncome
  if (
    scheduleC !== null &&
    schedule1 !== null &&
    scheduleC.netProfit !== null &&
    schedule1.businessIncome !== null
  ) {
    if (scheduleC.netProfit !== schedule1.businessIncome) {
      warnings.push(
        `Schedule C net profit ($${scheduleC.netProfit}) does not match Schedule 1 business income ($${schedule1.businessIncome})`
      )
    }
  }

  // Check Schedule 1 totalAdjustments matches Form 1040 adjustmentsToIncome
  if (
    schedule1 !== null &&
    schedule1.totalAdjustments !== null &&
    mainForm.adjustmentsToIncome !== null
  ) {
    if (schedule1.totalAdjustments !== mainForm.adjustmentsToIncome) {
      warnings.push(
        `Schedule 1 total adjustments ($${schedule1.totalAdjustments}) does not match Form 1040 Line 10 ($${mainForm.adjustmentsToIncome})`
      )
    }
  }

  // Check Schedule SE netProfitScheduleC matches Schedule C netProfit
  if (
    scheduleSE !== null &&
    scheduleC !== null &&
    scheduleSE.netProfitScheduleC !== null &&
    scheduleC.netProfit !== null
  ) {
    if (scheduleSE.netProfitScheduleC !== scheduleC.netProfit) {
      warnings.push(
        `Schedule SE net profit ($${scheduleSE.netProfitScheduleC}) does not match Schedule C net profit ($${scheduleC.netProfit})`
      )
    }
  }

  // Check if schedules are listed but extraction failed
  const attachedSchedules = mainForm.attachedSchedules || []
  if (attachedSchedules.includes('1') && schedule1 === null) {
    warnings.push('Schedule 1 detected in Form 1040 but extraction failed')
  }
  if (attachedSchedules.includes('C') && scheduleC === null) {
    warnings.push('Schedule C detected in Form 1040 but extraction failed')
  }
  if (attachedSchedules.includes('SE') && scheduleSE === null) {
    warnings.push('Schedule SE detected in Form 1040 but extraction failed')
  }
}
