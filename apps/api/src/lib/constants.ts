/**
 * Shared constants and helpers for API
 * Bilingual labels for document types and statuses
 */
import { config } from './config'

// Re-export config URLs for backward compatibility
export const PORTAL_URL = config.portalUrl
export const WORKSPACE_URL = config.workspaceUrl
export const API_URL = process.env.API_URL || 'http://localhost:3000'

// Pagination defaults (re-exported from config)
export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = config.pagination.defaultLimit
export const MAX_LIMIT = config.pagination.maxLimit

export type BackendLanguage = 'EN' | 'VI'

export function resolveBackendLanguage(language?: string | null): BackendLanguage {
  return language === 'VI' ? 'VI' : 'EN'
}

export function getLocalizedLabel(
  labels: { EN: Record<string, string>; VI: Record<string, string> },
  key: string,
  language?: string | null
): string {
  const resolvedLanguage = resolveBackendLanguage(language)
  return labels[resolvedLanguage][key] ?? labels.EN[key] ?? key
}

// English labels for DocType
export const DOC_TYPE_LABELS_EN: Record<string, string> = {
  SSN_CARD: 'SSN card',
  DRIVER_LICENSE: 'Driver license / ID',
  PASSPORT: 'Passport',
  W2: 'W-2 employment income',
  FORM_1099_INT: '1099-INT interest income',
  FORM_1099_DIV: '1099-DIV dividends',
  FORM_1099_NEC: '1099-NEC self-employment income',
  FORM_1099_MISC: '1099-MISC',
  FORM_1099_K: '1099-K payment card income',
  FORM_1099_R: '1099-R retirement income',
  FORM_1099_G: '1099-G government payments',
  FORM_1099_SSA: '1099-SSA Social Security',
  BANK_STATEMENT: 'Bank statement',
  PROFIT_LOSS_STATEMENT: 'Profit and loss statement',
  BUSINESS_LICENSE: 'Business license',
  EIN_LETTER: 'EIN letter',
  FORM_1098: '1098 mortgage interest',
  FORM_1098_T: '1098-T tuition',
  RECEIPT: 'Receipt',
  BIRTH_CERTIFICATE: 'Birth certificate',
  DAYCARE_RECEIPT: 'Daycare receipt',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
}

// Vietnamese labels for DocType
export const DOC_TYPE_LABELS_VI: Record<string, string> = {
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

export const DOC_TYPE_LABELS = {
  EN: DOC_TYPE_LABELS_EN,
  VI: DOC_TYPE_LABELS_VI,
}

export function getDocTypeLabelFromCatalog(docType: string, language?: string | null): string {
  return getLocalizedLabel(DOC_TYPE_LABELS, docType, language)
}

// English labels for TaxCaseStatus
export const CASE_STATUS_LABELS_EN: Record<string, string> = {
  INTAKE: 'Intake',
  WAITING_DOCS: 'Waiting for documents',
  IN_PROGRESS: 'In progress',
  READY_FOR_ENTRY: 'Ready for entry',
  ENTRY_COMPLETE: 'Entry complete',
  REVIEW: 'In review',
  FILED: 'Filed',
}

// Vietnamese labels for TaxCaseStatus
export const CASE_STATUS_LABELS_VI: Record<string, string> = {
  INTAKE: 'Tiếp nhận',
  WAITING_DOCS: 'Chờ tài liệu',
  IN_PROGRESS: 'Đang xử lý',
  READY_FOR_ENTRY: 'Sẵn sàng nhập liệu',
  ENTRY_COMPLETE: 'Đã nhập liệu',
  REVIEW: 'Đang kiểm tra',
  FILED: 'Đã nộp',
}

export const CASE_STATUS_LABELS = {
  EN: CASE_STATUS_LABELS_EN,
  VI: CASE_STATUS_LABELS_VI,
}

// English labels for ChecklistItemStatus
export const CHECKLIST_STATUS_LABELS_EN: Record<string, string> = {
  MISSING: 'Missing',
  HAS_RAW: 'Image received',
  HAS_DIGITAL: 'Extracted',
  VERIFIED: 'Verified',
  NOT_REQUIRED: 'Not required',
}

// Vietnamese labels for ChecklistItemStatus
export const CHECKLIST_STATUS_LABELS_VI: Record<string, string> = {
  MISSING: 'Thiếu',
  HAS_RAW: 'Đã nhận ảnh',
  HAS_DIGITAL: 'Đã trích xuất',
  VERIFIED: 'Đã xác minh',
  NOT_REQUIRED: 'Không cần',
}

export const CHECKLIST_STATUS_LABELS = {
  EN: CHECKLIST_STATUS_LABELS_EN,
  VI: CHECKLIST_STATUS_LABELS_VI,
}

// English labels for ActionType
export const ACTION_TYPE_LABELS_EN: Record<string, string> = {
  VERIFY_DOCS: 'Verify documents',
  AI_FAILED: 'AI could not identify the document',
  BLURRY_DETECTED: 'Blurry image detected',
  READY_FOR_ENTRY: 'Ready for entry',
  REMINDER_DUE: 'Reminder due',
  CLIENT_REPLIED: 'Client replied',
}

// Vietnamese labels for ActionType
export const ACTION_TYPE_LABELS_VI: Record<string, string> = {
  VERIFY_DOCS: 'Xác minh tài liệu',
  AI_FAILED: 'AI không nhận diện được',
  BLURRY_DETECTED: 'Ảnh bị mờ',
  READY_FOR_ENTRY: 'Sẵn sàng nhập liệu',
  REMINDER_DUE: 'Cần gửi nhắc nhở',
  CLIENT_REPLIED: 'Khách hàng trả lời',
}

export const ACTION_TYPE_LABELS = {
  EN: ACTION_TYPE_LABELS_EN,
  VI: ACTION_TYPE_LABELS_VI,
}

export const UNCLEAR_IMAGE_LABELS = {
  EN: 'Unclear image',
  VI: 'Ảnh không rõ',
}

export const BLURRY_IMAGE_RESEND_REASONS = {
  EN: 'Image is blurry. Please resend it.',
  VI: 'Ảnh bị mờ, vui lòng gửi lại',
}

// Helper to get pagination params with safe defaults
export function getPaginationParams(page?: number, limit?: number) {
  const safePage = Math.max(1, page || DEFAULT_PAGE)
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT))
  const skip = (safePage - 1) * safeLimit

  return { page: safePage, limit: safeLimit, skip }
}

// Helper to build pagination response
export function buildPaginationResponse(
  page: number,
  limit: number,
  total: number
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}
