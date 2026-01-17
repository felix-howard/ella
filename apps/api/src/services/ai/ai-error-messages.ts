/**
 * AI Error Messages - Vietnamese localization
 * Maps technical Gemini errors to user-friendly Vietnamese messages
 */

export type AIErrorType =
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'TIMEOUT'
  | 'CLASSIFICATION_FAILED'
  | 'OCR_FAILED'
  | 'PDF_INVALID'
  | 'PDF_ENCRYPTED'
  | 'PDF_TOO_LARGE'
  | 'PDF_CONVERSION_FAILED'
  | 'UNKNOWN'

interface ErrorMapping {
  pattern: RegExp
  type: AIErrorType
  vietnamese: string
  severity: 'info' | 'warning' | 'error'
}

// ReDoS-safe patterns using non-greedy quantifiers and limited character classes
const ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: /model\s+not\s+found|404|does not exist|is not supported/i,
    type: 'MODEL_NOT_FOUND',
    vietnamese: 'Mô hình AI không khả dụng. Hệ thống đang chuyển sang mô hình dự phòng.',
    severity: 'warning',
  },
  {
    pattern: /rate\s?limit/i,
    type: 'RATE_LIMIT',
    vietnamese: 'Hệ thống đang bận. Tài liệu sẽ được xử lý trong vài phút.',
    severity: 'info',
  },
  {
    pattern: /quota\s?exceeded|resource\s?exhausted/i,
    type: 'QUOTA_EXCEEDED',
    vietnamese: 'Đã vượt giới hạn xử lý AI. Vui lòng liên hệ quản trị viên.',
    severity: 'error',
  },
  {
    pattern: /503|service\s?unavailable|overloaded/i,
    type: 'SERVICE_UNAVAILABLE',
    vietnamese: 'Dịch vụ AI tạm ngưng. Vui lòng phân loại thủ công hoặc thử lại sau.',
    severity: 'warning',
  },
  {
    pattern: /invalid\s+image|unsupported\s+format|mime\s?type/i,
    type: 'INVALID_IMAGE',
    vietnamese: 'Định dạng hình ảnh không hợp lệ. Vui lòng tải lên ảnh JPEG, PNG hoặc PDF.',
    severity: 'error',
  },
  {
    pattern: /too\s+large|exceeds\s+maximum|size\s+limit/i,
    type: 'IMAGE_TOO_LARGE',
    vietnamese: 'Hình ảnh quá lớn. Vui lòng tải lên file nhỏ hơn 10MB.',
    severity: 'error',
  },
  {
    pattern: /timeout/i,
    type: 'TIMEOUT',
    vietnamese: 'Xử lý quá thời gian. Vui lòng thử lại.',
    severity: 'warning',
  },
  {
    pattern: /pdf.*invalid|invalid.*pdf|corrupt.*pdf/i,
    type: 'PDF_INVALID',
    vietnamese: 'Tệp PDF không hợp lệ hoặc bị hỏng.',
    severity: 'error',
  },
  {
    pattern: /pdf.*encrypt|password.*protect/i,
    type: 'PDF_ENCRYPTED',
    vietnamese: 'Tệp PDF được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi tải lên.',
    severity: 'error',
  },
  {
    pattern: /pdf.*too.*large|pdf.*size/i,
    type: 'PDF_TOO_LARGE',
    vietnamese: 'Tệp PDF quá lớn (tối đa 20MB).',
    severity: 'error',
  },
  {
    pattern: /pdf.*conversion|convert.*pdf.*fail/i,
    type: 'PDF_CONVERSION_FAILED',
    vietnamese: 'Không thể chuyển đổi PDF. Vui lòng thử lại hoặc tải lên hình ảnh.',
    severity: 'error',
  },
]

/**
 * Get Vietnamese error message from technical error
 * @param technicalError - Original error message from Gemini (nullable for safety)
 * @returns Localized error info with type, message, and severity
 */
export function getVietnameseError(technicalError: string | null | undefined): {
  type: AIErrorType
  message: string
  severity: 'info' | 'warning' | 'error'
} {
  // Input validation - handle null/undefined/empty
  const errorStr = technicalError?.toString().trim() || ''
  if (!errorStr) {
    return {
      type: 'UNKNOWN',
      message: 'Không thể xử lý tài liệu. Vui lòng phân loại thủ công.',
      severity: 'warning',
    }
  }

  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(errorStr)) {
      return {
        type: mapping.type,
        message: mapping.vietnamese,
        severity: mapping.severity,
      }
    }
  }

  // Default fallback for unrecognized errors
  return {
    type: 'UNKNOWN',
    message: 'Không thể xử lý tài liệu. Vui lòng phân loại thủ công.',
    severity: 'warning',
  }
}

/**
 * Get action title based on error type
 */
export function getActionTitle(errorType: AIErrorType): string {
  const titles: Record<AIErrorType, string> = {
    MODEL_NOT_FOUND: 'Cần chuyển mô hình AI',
    RATE_LIMIT: 'Đang chờ xử lý',
    QUOTA_EXCEEDED: 'Vượt giới hạn AI',
    SERVICE_UNAVAILABLE: 'AI không khả dụng',
    INVALID_IMAGE: 'Hình ảnh không hợp lệ',
    IMAGE_TOO_LARGE: 'File quá lớn',
    TIMEOUT: 'Quá thời gian xử lý',
    CLASSIFICATION_FAILED: 'Phân loại tự động thất bại',
    OCR_FAILED: 'Trích xuất dữ liệu thất bại',
    PDF_INVALID: 'PDF không hợp lệ',
    PDF_ENCRYPTED: 'PDF được bảo vệ',
    PDF_TOO_LARGE: 'PDF quá lớn',
    PDF_CONVERSION_FAILED: 'Chuyển đổi PDF thất bại',
    UNKNOWN: 'Lỗi xử lý AI',
  }
  return titles[errorType]
}

/**
 * Get action priority based on error severity
 */
export function getActionPriority(severity: 'info' | 'warning' | 'error'): 'NORMAL' | 'HIGH' {
  return severity === 'error' ? 'HIGH' : 'NORMAL'
}
