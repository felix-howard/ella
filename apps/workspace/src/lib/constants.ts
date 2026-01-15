/**
 * Vietnamese labels and constants for Ella Workspace
 * Centralized translations and UI text
 */

// Vietnamese labels for DocType
export const DOC_TYPE_LABELS: Record<string, string> = {
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
export const CASE_STATUS_LABELS: Record<string, string> = {
  INTAKE: 'Tiếp nhận',
  WAITING_DOCS: 'Chờ tài liệu',
  IN_PROGRESS: 'Đang xử lý',
  READY_FOR_ENTRY: 'Sẵn sàng nhập liệu',
  ENTRY_COMPLETE: 'Đã nhập liệu',
  REVIEW: 'Đang kiểm tra',
  FILED: 'Đã nộp',
}

// Status colors for UI
export const CASE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INTAKE: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  WAITING_DOCS: { bg: 'bg-warning-light', text: 'text-warning', border: 'border-warning' },
  IN_PROGRESS: { bg: 'bg-primary-light', text: 'text-primary', border: 'border-primary' },
  READY_FOR_ENTRY: { bg: 'bg-accent-light', text: 'text-accent', border: 'border-accent' },
  ENTRY_COMPLETE: { bg: 'bg-primary-light', text: 'text-primary-dark', border: 'border-primary-dark' },
  REVIEW: { bg: 'bg-warning-light', text: 'text-warning', border: 'border-warning' },
  FILED: { bg: 'bg-success/10', text: 'text-success', border: 'border-success' },
}

// Vietnamese labels for ChecklistItemStatus
export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  MISSING: 'Thiếu',
  HAS_RAW: 'Đã nhận ảnh',
  HAS_DIGITAL: 'Đã trích xuất',
  VERIFIED: 'Đã xác minh',
  NOT_REQUIRED: 'Không cần',
}

// Checklist status colors
export const CHECKLIST_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  MISSING: { bg: 'bg-error-light', text: 'text-error' },
  HAS_RAW: { bg: 'bg-warning-light', text: 'text-warning' },
  HAS_DIGITAL: { bg: 'bg-primary-light', text: 'text-primary' },
  VERIFIED: { bg: 'bg-success/10', text: 'text-success' },
  NOT_REQUIRED: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// Vietnamese labels for ActionType
export const ACTION_TYPE_LABELS: Record<string, string> = {
  VERIFY_DOCS: 'Xác minh tài liệu',
  AI_FAILED: 'AI không nhận diện được',
  BLURRY_DETECTED: 'Ảnh bị mờ',
  READY_FOR_ENTRY: 'Sẵn sàng nhập liệu',
  REMINDER_DUE: 'Cần gửi nhắc nhở',
  CLIENT_REPLIED: 'Khách hàng trả lời',
}

// Action type colors
export const ACTION_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  VERIFY_DOCS: { bg: 'bg-primary-light', text: 'text-primary', icon: 'CheckCircle' },
  AI_FAILED: { bg: 'bg-error-light', text: 'text-error', icon: 'AlertTriangle' },
  BLURRY_DETECTED: { bg: 'bg-warning-light', text: 'text-warning', icon: 'Eye' },
  READY_FOR_ENTRY: { bg: 'bg-accent-light', text: 'text-accent', icon: 'FileText' },
  REMINDER_DUE: { bg: 'bg-warning-light', text: 'text-warning', icon: 'Bell' },
  CLIENT_REPLIED: { bg: 'bg-success/10', text: 'text-success', icon: 'MessageCircle' },
}

// Vietnamese labels for ActionPriority
export const ACTION_PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Khẩn cấp',
  HIGH: 'Cao',
  NORMAL: 'Bình thường',
  LOW: 'Thấp',
}

// Priority colors
export const ACTION_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: 'bg-error', text: 'text-white' },
  HIGH: { bg: 'bg-accent', text: 'text-white' },
  NORMAL: { bg: 'bg-primary', text: 'text-white' },
  LOW: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// Vietnamese labels for TaxType
export const TAX_TYPE_LABELS: Record<string, string> = {
  FORM_1040: '1040 (Cá nhân)',
  FORM_1120S: '1120S (S-Corp)',
  FORM_1065: '1065 (Partnership)',
}

// Vietnamese labels for Language
export const LANGUAGE_LABELS: Record<string, string> = {
  VI: 'Tiếng Việt',
  EN: 'English',
}

// Vietnamese labels for FilingStatus
export const FILING_STATUS_LABELS: Record<string, string> = {
  SINGLE: 'Độc thân',
  MARRIED_FILING_JOINTLY: 'Vợ chồng khai chung',
  MARRIED_FILING_SEPARATELY: 'Vợ chồng khai riêng',
  HEAD_OF_HOUSEHOLD: 'Chủ hộ',
  QUALIFYING_WIDOW: 'Góa phụ có con',
}

// AI Classification thresholds
// Used for determining when documents need manual review
export const AI_CONFIDENCE_THRESHOLDS = {
  /** High confidence - auto-approve */
  HIGH: 0.85,
  /** Medium confidence - needs review */
  MEDIUM: 0.60,
} as const

// AI Classification confidence level config
// Used for confidence badges in image gallery and review workflow
export const CONFIDENCE_LEVELS = {
  HIGH: { min: AI_CONFIDENCE_THRESHOLDS.HIGH, label: 'Cao', color: 'text-success', bg: 'bg-success/10' },
  MEDIUM: { min: AI_CONFIDENCE_THRESHOLDS.MEDIUM, label: 'Trung bình', color: 'text-warning', bg: 'bg-warning/10' },
  LOW: { min: 0, label: 'Thấp', color: 'text-error', bg: 'bg-error/10' },
} as const

/**
 * Check if classification needs manual review based on confidence
 * @param confidence - Confidence score from 0-1
 * @returns true if confidence is below HIGH threshold
 */
export function needsClassificationReview(confidence: number | null): boolean {
  return !confidence || confidence < AI_CONFIDENCE_THRESHOLDS.HIGH
}

/**
 * Get confidence level based on score
 * @param confidence - Confidence score from 0-1
 * @returns Confidence level config (HIGH, MEDIUM, or LOW)
 */
export function getConfidenceLevel(confidence: number | null) {
  if (!confidence || confidence < AI_CONFIDENCE_THRESHOLDS.MEDIUM) return CONFIDENCE_LEVELS.LOW
  if (confidence < AI_CONFIDENCE_THRESHOLDS.HIGH) return CONFIDENCE_LEVELS.MEDIUM
  return CONFIDENCE_LEVELS.HIGH
}

// Sidebar navigation items
export const NAV_ITEMS = [
  { path: '/', label: 'Tổng quan', icon: 'LayoutDashboard' },
  { path: '/actions', label: 'Việc cần làm', icon: 'CheckSquare' },
  { path: '/clients', label: 'Khách hàng', icon: 'Users' },
  { path: '/messages', label: 'Tin nhắn', icon: 'MessageSquare' },
] as const

// Common UI text
export const UI_TEXT = {
  // General
  loading: 'Đang tải...',
  error: 'Đã có lỗi xảy ra',
  retry: 'Thử lại',
  save: 'Lưu',
  cancel: 'Hủy',
  delete: 'Xóa',
  edit: 'Sửa',
  create: 'Tạo mới',
  search: 'Tìm kiếm...',
  noData: 'Không có dữ liệu',
  confirm: 'Xác nhận',
  logout: 'Đăng xuất',
  notifications: 'Thông báo',
  addClient: 'Thêm khách',

  // Dashboard
  dashboard: {
    greeting: 'Xin chào',
    greetingSubtext: 'Đây là tổng quan công việc hôm nay của bạn',
    todaySummary: 'Hôm nay',
    pendingActions: 'Việc cần làm',
    newClients: 'Khách hàng mới',
    docsReceived: 'Tài liệu đã nhận',
    blurryDocs: 'Ảnh bị mờ',
    quickActions: 'Thao tác nhanh',
    recentActivity: 'Hoạt động gần đây',
    noRecentActivity: 'Chưa có hoạt động nào gần đây',
  },

  // Quick Actions
  quickAction: {
    addClient: 'Thêm khách hàng',
    viewActions: 'Xem việc cần làm',
    verifyDocs: 'Xác minh tài liệu',
    handleBlurry: 'Xử lý ảnh mờ',
  },

  // Clients
  clients: {
    title: 'Khách hàng',
    newClient: 'Thêm khách hàng',
    noClients: 'Chưa có khách hàng nào',
    noClientsHint: 'Thêm khách hàng mới để bắt đầu',
    noCase: 'Chưa có hồ sơ',
    searchPlaceholder: 'Tìm theo tên hoặc số điện thoại...',
    viewKanban: 'Xem Kanban',
    viewList: 'Xem danh sách',
    backToList: 'Quay lại danh sách',
    count: 'khách hàng',
    personalInfo: 'Thông tin cá nhân',
    taxProfile: 'Hồ sơ thuế',
    checklistTitle: 'Danh sách tài liệu',
    tabs: {
      overview: 'Tổng quan',
      documents: 'Tài liệu',
      messages: 'Tin nhắn',
    },
  },

  // Kanban
  kanban: {
    noClients: 'Không có khách hàng',
  },

  // Actions
  actions: {
    title: 'Việc cần làm',
    noActions: 'Không có việc nào cần làm',
    markComplete: 'Đánh dấu hoàn thành',
    complete: 'Hoàn thành',
    viewDetail: 'Xem chi tiết',
    refresh: 'Làm mới',
    filterBy: 'Lọc theo',
    typeFilter: 'Loại',
    priorityFilter: 'Mức độ',
    all: 'Tất cả',
    allDone: 'Tất cả công việc đã được hoàn thành!',
    pendingCount: 'việc cần làm',
  },

  // Forms
  form: {
    clientName: 'Tên khách hàng',
    phone: 'Số điện thoại',
    email: 'Email',
    language: 'Ngôn ngữ',
    taxYear: 'Năm thuế',
    taxTypes: 'Loại tờ khai',
    filingStatus: 'Tình trạng hôn nhân',
    required: 'Bắt buộc',
  },

  // Error boundary
  errorBoundary: {
    title: 'Đã có lỗi xảy ra',
    message: 'Xin lỗi, ứng dụng gặp sự cố. Vui lòng thử lại.',
    retry: 'Thử lại',
  },

  // Staff info (placeholder)
  staff: {
    defaultName: 'Nhân viên',
    defaultEmail: 'staff@ella.app',
  },
}
