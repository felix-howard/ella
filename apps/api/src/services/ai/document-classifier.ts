/**
 * Document Classifier Service
 * Classifies uploaded images into document types using Gemini vision
 */
import { analyzeImage, analyzeMultipleImages, isGeminiConfigured } from './gemini-client'
import {
  getClassificationPrompt,
  validateClassificationResult,
  getSmartRenamePrompt,
  validateSmartRenameResult,
  getGroupingAnalysisPrompt,
  validateGroupingResult,
} from './prompts/classify'
import type {
  ClassificationResult,
  SupportedDocType,
  SmartRenameResult,
  GroupingAnalysisResult,
  ExtractedMetadata,
} from './prompts/classify'
import { config } from '../../lib/config'
import { getCategoryFromDocType } from '@ella/shared'
import type { DocCategory } from '@ella/shared'

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
  // Naming components for auto-rename feature
  category: DocCategory
  taxYear: number | null
  source: string | null
  recipientName: string | null // Person's name extracted from document
  // Metadata for hierarchical clustering (Phase 1 grouping redesign)
  extractedMetadata?: ExtractedMetadata
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
      category: 'OTHER',
      taxYear: null,
      source: null,
      recipientName: null,
      extractedMetadata: undefined,
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
      category: 'OTHER',
      taxYear: null,
      source: null,
      recipientName: null,
      extractedMetadata: undefined,
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
        category: 'OTHER',
        taxYear: null,
        source: null,
        recipientName: null,
        extractedMetadata: undefined,
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
        category: 'OTHER',
        taxYear: null,
        source: null,
        recipientName: null,
        extractedMetadata: undefined,
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
      category: getCategoryFromDocType(result.data.docType),
      taxYear: result.data.taxYear ?? null,
      source: result.data.source ?? null,
      recipientName: result.data.recipientName ?? null,
      extractedMetadata: result.data.extractedMetadata,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      docType: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Classification error occurred',
      category: 'OTHER',
      taxYear: null,
      source: null,
      recipientName: null,
      extractedMetadata: undefined,
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
    MARRIAGE_CERTIFICATE: 'Giấy kết hôn',
    DIVORCE_DECREE: 'Giấy ly hôn',
    GREEN_CARD: 'Thẻ xanh (Green Card)',
    WORK_VISA: 'Visa lao động',
    NATURALIZATION_CERTIFICATE: 'Giấy nhập quốc tịch',
    POWER_OF_ATTORNEY: 'Giấy ủy quyền',

    // Employment Income
    W2: 'W2 (Thu nhập từ công việc)',
    W2G: 'W2G (Thắng cờ bạc)',
    PAY_STUB: 'Phiếu lương',
    EMPLOYMENT_CONTRACT: 'Hợp đồng lao động',
    STOCK_OPTION_AGREEMENT: 'Quyền chọn cổ phiếu',
    RSU_STATEMENT: 'Báo cáo RSU',
    ESPP_STATEMENT: 'Báo cáo ESPP',

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
    FORM_1099_A: '1099-A (Thu hồi tài sản)',
    FORM_1099_CAP: '1099-CAP (Thay đổi công ty)',
    FORM_1099_H: '1099-H (Tín dụng bảo hiểm)',
    FORM_1099_LS: '1099-LS (Bán bảo hiểm nhân thọ)',
    FORM_1099_LTC: '1099-LTC (Chăm sóc dài hạn)',
    FORM_1099_OID: '1099-OID (Chiết khấu gốc)',
    FORM_1099_PATR: '1099-PATR (Cổ tức hợp tác xã)',
    FORM_1099_QA: '1099-QA (Phân phối ABLE)',
    FORM_1099_SB: '1099-SB (Đầu tư bảo hiểm)',
    RRB_1099: 'RRB-1099 (Hưu trí đường sắt)',
    RRB_1099_R: 'RRB-1099-R (Hưu trí đường sắt T2)',

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
    PARTNERSHIP_AGREEMENT: 'Hợp đồng hợp danh',
    SHAREHOLDER_AGREEMENT: 'Hợp đồng cổ đông',
    BUSINESS_INVOICE: 'Hóa đơn kinh doanh',
    ACCOUNTS_RECEIVABLE: 'Khoản phải thu',
    ACCOUNTS_PAYABLE: 'Khoản phải trả',
    INVENTORY_REPORT: 'Báo cáo tồn kho',
    SALES_TAX_REPORT: 'Báo cáo thuế bán hàng',

    // Receipts & Supporting Docs
    RECEIPT: 'Hóa đơn / Biên lai',
    DAYCARE_RECEIPT: 'Hóa đơn daycare',
    CHARITY_RECEIPT: 'Biên lai từ thiện',
    MEDICAL_RECEIPT: 'Hóa đơn y tế',
    PROPERTY_TAX_STATEMENT: 'Phiếu thuế bất động sản',
    ESTIMATED_TAX_PAYMENT: 'Đóng estimated tax',
    RENT_RECEIPT: 'Biên lai tiền thuê',

    // Prior Year / IRS
    PRIOR_YEAR_RETURN: 'Tờ khai năm trước',
    IRS_NOTICE: 'Thư từ IRS',

    // Crypto
    CRYPTO_STATEMENT: 'Báo cáo Crypto',
    CRYPTO_TAX_REPORT: 'Báo cáo thuế Crypto',
    CRYPTO_TRANSACTION_HISTORY: 'Lịch sử giao dịch Crypto',
    STAKING_REWARDS: 'Phần thưởng Staking',

    // Foreign
    FOREIGN_BANK_STATEMENT: 'Sao kê ngân hàng nước ngoài',
    FOREIGN_TAX_STATEMENT: 'Chứng từ thuế nước ngoài',
    FBAR_SUPPORT_DOCS: 'Tài liệu hỗ trợ FBAR',
    FORM_8938: 'Form 8938 (FATCA)',

    // Real Estate / Home Sale
    CLOSING_DISCLOSURE: 'Closing Disclosure',
    LEASE_AGREEMENT: 'Hợp đồng thuê nhà',
    HUD_1: 'HUD-1 (Báo cáo giao dịch)',
    PROPERTY_DEED: 'Giấy chủ quyền nhà',
    HOME_APPRAISAL: 'Định giá nhà',
    PMI_STATEMENT: 'Báo cáo PMI',

    // Credits / Energy
    EV_PURCHASE_AGREEMENT: 'Hợp đồng mua xe điện',
    ENERGY_CREDIT_INVOICE: 'Hóa đơn năng lượng xanh',

    // Additional Business Docs
    FORM_W9_ISSUED: 'W-9 đã thu',
    MORTGAGE_POINTS_STATEMENT: 'Điểm mortgage',

    // Prior Year Extension
    EXTENSION_PAYMENT_PROOF: 'Bằng chứng extension',

    // Tax Returns
    FORM_1040: 'Tờ khai 1040 (Liên bang)',
    FORM_1040_SR: 'Tờ khai 1040-SR (Người cao tuổi)',
    FORM_1040_NR: 'Tờ khai 1040-NR (Người nước ngoài)',
    FORM_1040_X: 'Tờ khai 1040-X (Điều chỉnh)',
    STATE_TAX_RETURN: 'Tờ khai thuế tiểu bang',
    FOREIGN_TAX_RETURN: 'Tờ khai thuế nước ngoài',
    TAX_RETURN_TRANSCRIPT: 'Bản sao tờ khai IRS',

    // Form 1040 Schedules
    SCHEDULE_C: 'Schedule C (Lợi nhuận kinh doanh)',
    SCHEDULE_SE: 'Schedule SE (Thuế tự làm chủ)',
    SCHEDULE_1: 'Schedule 1 (Thu nhập & Điều chỉnh)',
    SCHEDULE_D: 'Schedule D (Lãi/Lỗ vốn)',
    SCHEDULE_E: 'Schedule E (Thu nhập cho thuê)',
    SCHEDULE_2: 'Schedule 2 (Thuế bổ sung)',
    SCHEDULE_3: 'Schedule 3 (Tín dụng & Thanh toán)',
    SCHEDULE_A: 'Schedule A (Khấu trừ chi tiết)',
    SCHEDULE_B: 'Schedule B (Lãi & Cổ tức)',
    SCHEDULE_EIC: 'Schedule EIC (Tín dụng thu nhập)',
    SCHEDULE_F: 'Schedule F (Thu nhập nông nghiệp)',
    SCHEDULE_H: 'Schedule H (Thuế nhân viên gia đình)',
    SCHEDULE_J: 'Schedule J (Thu nhập bình quân)',
    SCHEDULE_R: 'Schedule R (Tín dụng người già)',
    SCHEDULE_8812: 'Schedule 8812 (Tín dụng trẻ em)',

    // Critical IRS Forms
    FORM_2210: 'Form 2210 (Phạt thiếu thuế)',
    FORM_2441: 'Form 2441 (Chi phí trông trẻ)',
    FORM_2555: 'Form 2555 (Thu nhập nước ngoài)',
    FORM_3903: 'Form 3903 (Chi phí di chuyển)',
    FORM_4562: 'Form 4562 (Khấu hao)',
    FORM_4684: 'Form 4684 (Thiệt hại & Mất mát)',
    FORM_4797: 'Form 4797 (Bán tài sản KD)',
    FORM_4868: 'Form 4868 (Gia hạn nộp)',
    FORM_5329: 'Form 5329 (Thuế hưu trí bổ sung)',
    FORM_5695: 'Form 5695 (Tín dụng năng lượng)',
    FORM_6251: 'Form 6251 (Thuế tối thiểu AMT)',
    FORM_8283: 'Form 8283 (Từ thiện phi tiền mặt)',
    FORM_8379: 'Form 8379 (Phân bổ vợ/chồng)',
    FORM_8582: 'Form 8582 (Lỗ hoạt động thụ động)',
    FORM_8606: 'Form 8606 (IRA không khấu trừ)',
    FORM_8829: 'Form 8829 (Văn phòng tại nhà)',
    FORM_8863: 'Form 8863 (Tín dụng giáo dục)',
    FORM_8880: 'Form 8880 (Tín dụng tiết kiệm hưu)',
    FORM_8889: 'Form 8889 (Khấu trừ HSA)',
    FORM_8936: 'Form 8936 (Tín dụng xe điện)',
    FORM_8949: 'Form 8949 (Bán tài sản vốn)',
    FORM_8959: 'Form 8959 (Thuế Medicare bổ sung)',
    FORM_8960: 'Form 8960 (Thuế thu nhập đầu tư)',
    FORM_8962: 'Form 8962 (Tín dụng bảo hiểm PTC)',
    FORM_8995: 'Form 8995 (Khấu trừ QBI)',
    FORM_8995_A: 'Form 8995-A (Khấu trừ QBI phức tạp)',

    // Investment Documents
    BROKERAGE_STATEMENT: 'Sao kê chứng khoán',
    TRADE_CONFIRMATION: 'Xác nhận giao dịch',
    COST_BASIS_STATEMENT: 'Báo cáo giá gốc',
    MUTUAL_FUND_STATEMENT: 'Sao kê quỹ đầu tư',
    DIVIDEND_REINVESTMENT: 'Tái đầu tư cổ tức',

    // Retirement Documents
    PENSION_STATEMENT: 'Sao kê lương hưu',
    IRA_STATEMENT: 'Sao kê IRA',
    STATEMENT_401K: 'Sao kê 401(k)',
    ROTH_IRA_STATEMENT: 'Sao kê Roth IRA',
    RMD_STATEMENT: 'Sao kê RMD',

    // Healthcare Documents
    MEDICAL_BILL: 'Hóa đơn y tế',
    INSURANCE_EOB: 'Giải thích bảo hiểm (EOB)',
    HSA_STATEMENT: 'Sao kê HSA',
    FSA_STATEMENT: 'Sao kê FSA',

    // Insurance Documents
    AUTO_INSURANCE: 'Bảo hiểm xe',
    HOME_INSURANCE: 'Bảo hiểm nhà',
    LIFE_INSURANCE_STATEMENT: 'Sao kê bảo hiểm nhân thọ',
    DISABILITY_INSURANCE: 'Bảo hiểm tàn tật',

    // Legal Documents
    COURT_ORDER: 'Lệnh tòa án',
    SETTLEMENT_AGREEMENT: 'Thỏa thuận hòa giải',
    ALIMONY_AGREEMENT: 'Thỏa thuận cấp dưỡng',
    CHILD_SUPPORT_ORDER: 'Lệnh trợ cấp nuôi con',
    BANKRUPTCY_DOCUMENTS: 'Giấy tờ phá sản',

    // Childcare Documents
    DAYCARE_STATEMENT: 'Sao kê daycare',
    DEPENDENT_CARE_FSA: 'Sao kê FSA chăm sóc',
    NANNY_DOCUMENTATION: 'Giấy tờ người giữ trẻ',

    // Gambling Documents
    GAMBLING_LOSS_STATEMENT: 'Sao kê lỗ cờ bạc',

    // Miscellaneous Documents
    BANK_LETTER: 'Thư ngân hàng',
    LOAN_STATEMENT: 'Sao kê khoản vay',
    MEMBERSHIP_DUES: 'Phí thành viên',
    PROFESSIONAL_LICENSE: 'Giấy phép hành nghề',

    // Other
    OTHER: 'Khác',
    UNKNOWN: 'Chưa xác định',
  }
  return labels[docType] || 'Chưa xác định'
}

// Suspicious patterns for prompt injection detection (H3)
const SUSPICIOUS_PATTERNS = [
  /\.\.\//,           // Path traversal
  /\/etc\//i,         // Unix config paths
  /\/passwd/i,        // Password files
  /\$\{/,             // Template injection
  /<script/i,         // XSS attempts
  /javascript:/i,     // JS protocol
]

/**
 * Sanitize filename: ensure max 60 chars, no special chars, no suspicious patterns
 * @param filename - Raw filename from AI
 * @returns Sanitized filename or null if suspicious
 */
function sanitizeFilename(filename: string): string | null {
  // H3: Check for suspicious patterns (prompt injection)
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(filename)) {
      console.warn('[SmartRename] Suspicious pattern detected in filename, rejecting')
      return null
    }
  }

  // Sanitize: remove special chars, collapse underscores, max 60 chars
  const sanitized = filename
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .replace(/^_|_$/g, '')           // Remove leading/trailing underscores
    .substring(0, 60)                // Max 60 chars

  // M6: Ensure non-empty after sanitization
  return sanitized.length > 0 ? sanitized : null
}

/**
 * Generate smart filename for documents that can't be classified
 * Used as fallback when classification confidence < 60%
 *
 * @param imageBuffer - The image file buffer
 * @param mimeType - MIME type of the image
 * @returns SmartRename result with suggested filename and metadata
 */
export async function generateSmartFilename(
  imageBuffer: Buffer,
  mimeType: string
): Promise<SmartRenameResult | null> {
  const startTime = Date.now()

  if (!isGeminiConfigured) {
    console.warn('[SmartRename] Gemini not configured, skipping')
    return null
  }

  try {
    const prompt = getSmartRenamePrompt()
    const result = await analyzeImage<SmartRenameResult>(imageBuffer, mimeType, prompt)

    if (!result.success || !result.data) {
      console.warn('[SmartRename] AI call failed:', result.error)
      return null
    }

    // H1: Sanitize BEFORE validation to check real filename length
    const sanitizedFilename = sanitizeFilename(result.data.suggestedFilename)
    if (!sanitizedFilename) {
      console.warn('[SmartRename] Filename sanitization failed')
      return null
    }

    if (!validateSmartRenameResult(result.data)) {
      console.warn('[SmartRename] Invalid response structure')
      return null
    }

    console.log(`[SmartRename] Generated: ${sanitizedFilename} (${Date.now() - startTime}ms)`)

    return {
      ...result.data,
      suggestedFilename: sanitizedFilename,
    }
  } catch (error) {
    console.error('[SmartRename] Error:', error)
    return null
  }
}

/**
 * Analyze documents for potential multi-page grouping
 * Compares new document against candidate documents from the same case
 *
 * @param newDocImage - Buffer of the newly uploaded document
 * @param candidateImages - Buffers of existing documents to compare against
 * @param candidateDocs - Metadata for candidates (id, displayName) for logging
 * @returns Grouping analysis result indicating if documents belong together
 */
export async function analyzeDocumentGrouping(
  newDocImage: Buffer,
  candidateImages: Buffer[],
  candidateDocs: Array<{ id: string; displayName: string | null }>
): Promise<GroupingAnalysisResult> {
  const startTime = Date.now()

  // Return early if no candidates or AI not configured
  if (!isGeminiConfigured || candidateImages.length === 0) {
    return {
      matchFound: false,
      matchedIndices: [],
      confidence: 0,
      groupName: null,
      pageOrder: [],
      reasoning: 'No candidates or AI not configured',
      metadataValidation: {
        taxpayerNameMatch: null,
        ssn4Match: null,
        pageMarkersAlign: null,
        confidenceBoost: 0,
      },
    }
  }

  try {
    const prompt = getGroupingAnalysisPrompt(candidateImages.length)

    // Create multi-image array: new doc first, then candidates
    const images = [newDocImage, ...candidateImages]

    const result = await analyzeMultipleImages<GroupingAnalysisResult>(
      images,
      'image/jpeg',
      prompt
    )

    if (!result.success || !result.data) {
      console.warn('[Grouping] AI analysis failed:', result.error)
      return {
        matchFound: false,
        matchedIndices: [],
        confidence: 0,
        groupName: null,
        pageOrder: [],
        reasoning: result.error || 'AI analysis failed',
        metadataValidation: {
          taxpayerNameMatch: null,
          ssn4Match: null,
          pageMarkersAlign: null,
          confidenceBoost: 0,
        },
      }
    }

    // Validate response structure
    if (!validateGroupingResult(result.data)) {
      console.warn('[Grouping] Invalid response structure')
      return {
        matchFound: false,
        matchedIndices: [],
        confidence: 0,
        groupName: null,
        pageOrder: [],
        reasoning: 'Invalid AI response structure',
        metadataValidation: {
          taxpayerNameMatch: null,
          ssn4Match: null,
          pageMarkersAlign: null,
          confidenceBoost: 0,
        },
      }
    }

    const elapsed = Date.now() - startTime
    if (result.data.matchFound) {
      console.log(
        `[Grouping] Match found: ${result.data.groupName} ` +
        `(confidence: ${(result.data.confidence * 100).toFixed(0)}%, ${elapsed}ms)`
      )
    } else {
      console.log(`[Grouping] No match found (${elapsed}ms)`)
    }

    return result.data
  } catch (error) {
    console.error('[Grouping] Analysis error:', error)
    return {
      matchFound: false,
      matchedIndices: [],
      confidence: 0,
      groupName: null,
      pageOrder: [],
      reasoning: 'Analysis error',
      metadataValidation: {
        taxpayerNameMatch: null,
        ssn4Match: null,
        pageMarkersAlign: null,
        confidenceBoost: 0,
      },
    }
  }
}
