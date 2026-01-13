/**
 * Shared constants and helpers for API
 * Vietnamese labels for document types and statuses
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

// Vietnamese labels for ChecklistItemStatus
export const CHECKLIST_STATUS_LABELS_VI: Record<string, string> = {
  MISSING: 'Thiếu',
  HAS_RAW: 'Đã nhận ảnh',
  HAS_DIGITAL: 'Đã trích xuất',
  VERIFIED: 'Đã xác minh',
  NOT_REQUIRED: 'Không cần',
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
