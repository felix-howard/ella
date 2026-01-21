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
 * Uses exclusion-based approach for easier maintenance
 * (Exclude 7 types vs include 17+ types)
 */
export function requiresOcrExtraction(docType: SupportedDocType | 'UNKNOWN'): boolean {
  // Types that do NOT require OCR extraction
  const noOcrTypes: Array<SupportedDocType | 'UNKNOWN'> = [
    'PASSPORT',           // Photo ID only, no structured data
    'PROFIT_LOSS_STATEMENT', // Free-form business docs
    'BUSINESS_LICENSE',   // Varies too much by jurisdiction
    'EIN_LETTER',         // Simple letter format
    'RECEIPT',            // Too varied to extract reliably
    'BIRTH_CERTIFICATE',  // Only for dependent verification
    'DAYCARE_RECEIPT',    // Varies by provider
    'OTHER',              // Unknown format
    'UNKNOWN',            // Unclassified
  ]
  return !noOcrTypes.includes(docType)
}

/**
 * Get human-readable label for document type (Vietnamese)
 */
export function getDocTypeLabel(docType: SupportedDocType | 'UNKNOWN'): string {
  const labels: Record<SupportedDocType, string> = {
    // Personal / Identity
    SSN_CARD: 'Thẻ SSN',
    DRIVER_LICENSE: 'Bằng Lái / ID',
    PASSPORT: 'Hộ chiếu',
    BIRTH_CERTIFICATE: 'Giấy khai sinh',
    ITIN_LETTER: 'Thư ITIN',

    // Employment Income
    W2: 'W2 (Thu nhập từ công việc)',
    W2G: 'W2G (Thắng cờ bạc)',

    // 1099 Series
    FORM_1099_INT: '1099-INT (Lãi ngân hàng)',
    FORM_1099_DIV: '1099-DIV (Cổ tức)',
    FORM_1099_NEC: '1099-NEC (Thu nhập tự do)',
    FORM_1099_MISC: '1099-MISC (Thu nhập khác)',
    FORM_1099_K: '1099-K (Thu nhập thẻ)',
    FORM_1099_R: '1099-R (Tiền hưu)',
    FORM_1099_G: '1099-G (Thanh toán chính phủ)',
    FORM_1099_SSA: '1099-SSA (An sinh xã hội)',
    FORM_1099_B: '1099-B (Bán cổ phiếu)',
    FORM_1099_S: '1099-S (Bán bất động sản)',
    FORM_1099_C: '1099-C (Xóa nợ)',
    FORM_1099_SA: '1099-SA (Phân phối HSA)',
    FORM_1099_Q: '1099-Q (Phân phối 529)',

    // K-1 Forms
    SCHEDULE_K1: 'K-1 (Thu nhập công ty)',
    SCHEDULE_K1_1065: 'K-1 (Partnership)',
    SCHEDULE_K1_1120S: 'K-1 (S-Corp)',
    SCHEDULE_K1_1041: 'K-1 (Trust/Estate)',

    // Health Insurance
    FORM_1095_A: '1095-A (Bảo hiểm Marketplace)',
    FORM_1095_B: '1095-B (Bảo hiểm sức khỏe)',
    FORM_1095_C: '1095-C (Bảo hiểm qua công ty)',
    FORM_5498_SA: '5498-SA (Đóng góp HSA)',

    // Education
    FORM_1098_T: '1098-T (Học phí)',
    FORM_1098_E: '1098-E (Lãi student loan)',

    // Deductions / Credits
    FORM_1098: '1098 (Lãi vay nhà)',
    FORM_8332: 'Form 8332 (Release Exemption)',

    // Business Documents
    BANK_STATEMENT: 'Sao kê ngân hàng',
    PROFIT_LOSS_STATEMENT: 'Báo cáo lời lỗ',
    BALANCE_SHEET: 'Bảng cân đối',
    BUSINESS_LICENSE: 'Giấy phép kinh doanh',
    EIN_LETTER: 'Thư EIN',
    ARTICLES_OF_INCORPORATION: 'Điều lệ công ty',
    OPERATING_AGREEMENT: 'Hợp đồng hoạt động',
    PAYROLL_REPORT: 'Báo cáo lương',
    DEPRECIATION_SCHEDULE: 'Bảng khấu hao',
    VEHICLE_MILEAGE_LOG: 'Nhật ký lái xe',

    // Receipts & Supporting Docs
    RECEIPT: 'Hóa đơn / Biên lai',
    DAYCARE_RECEIPT: 'Hóa đơn daycare',
    CHARITY_RECEIPT: 'Biên lai từ thiện',
    MEDICAL_RECEIPT: 'Hóa đơn y tế',
    PROPERTY_TAX_STATEMENT: 'Phiếu thuế bất động sản',
    ESTIMATED_TAX_PAYMENT: 'Đóng estimated tax',

    // Prior Year / IRS
    PRIOR_YEAR_RETURN: 'Tờ khai năm trước',
    IRS_NOTICE: 'Thư từ IRS',

    // Crypto
    CRYPTO_STATEMENT: 'Báo cáo Crypto',

    // Foreign
    FOREIGN_BANK_STATEMENT: 'Sao kê ngân hàng nước ngoài',
    FOREIGN_TAX_STATEMENT: 'Chứng từ thuế nước ngoài',
    FBAR_SUPPORT_DOCS: 'Tài liệu hỗ trợ FBAR',
    FORM_8938: 'Form 8938 (FATCA)',

    // Real Estate / Home Sale
    CLOSING_DISCLOSURE: 'Closing Disclosure',
    LEASE_AGREEMENT: 'Hợp đồng thuê nhà',

    // Credits / Energy
    EV_PURCHASE_AGREEMENT: 'Hợp đồng mua xe điện',
    ENERGY_CREDIT_INVOICE: 'Hóa đơn năng lượng xanh',

    // Additional Business Docs
    FORM_W9_ISSUED: 'W-9 đã thu',
    MORTGAGE_POINTS_STATEMENT: 'Điểm mortgage',

    // Prior Year Extension
    EXTENSION_PAYMENT_PROOF: 'Bằng chứng extension',

    // Other
    OTHER: 'Khác',
    UNKNOWN: 'Chưa xác định',
  }
  return labels[docType] || 'Chưa xác định'
}
