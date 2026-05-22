/**
 * AI Error Messages
 * Maps technical Gemini errors to user-friendly localized messages.
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
  english: string
  vietnamese: string
  severity: 'info' | 'warning' | 'error'
}

// ReDoS-safe patterns using non-greedy quantifiers and limited character classes
const ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: /model\s+not\s+found|404|does not exist|is not supported/i,
    type: 'MODEL_NOT_FOUND',
    english: 'AI model is unavailable. The system is switching to a fallback model.',
    vietnamese: 'Mô hình AI không khả dụng. Hệ thống đang chuyển sang mô hình dự phòng.',
    severity: 'warning',
  },
  {
    pattern: /rate\s?limit/i,
    type: 'RATE_LIMIT',
    english: 'The system is busy. This document will be processed in a few minutes.',
    vietnamese: 'Hệ thống đang bận. Tài liệu sẽ được xử lý trong vài phút.',
    severity: 'info',
  },
  {
    pattern: /quota\s?exceeded|resource\s?exhausted/i,
    type: 'QUOTA_EXCEEDED',
    english: 'AI processing quota has been exceeded. Please contact an administrator.',
    vietnamese: 'Đã vượt giới hạn xử lý AI. Vui lòng liên hệ quản trị viên.',
    severity: 'error',
  },
  {
    pattern: /503|service\s?unavailable|overloaded/i,
    type: 'SERVICE_UNAVAILABLE',
    english: 'AI service is temporarily unavailable. Please classify manually or try again later.',
    vietnamese: 'Dịch vụ AI tạm ngưng. Vui lòng phân loại thủ công hoặc thử lại sau.',
    severity: 'warning',
  },
  {
    pattern: /invalid\s+image|unsupported\s+format|mime\s?type/i,
    type: 'INVALID_IMAGE',
    english: 'Invalid image format. Please upload a JPEG, PNG, or PDF file.',
    vietnamese: 'Định dạng hình ảnh không hợp lệ. Vui lòng tải lên ảnh JPEG, PNG hoặc PDF.',
    severity: 'error',
  },
  {
    pattern: /too\s+large|exceeds\s+maximum|size\s+limit/i,
    type: 'IMAGE_TOO_LARGE',
    english: 'Image is too large. Please upload a file smaller than 10MB.',
    vietnamese: 'Hình ảnh quá lớn. Vui lòng tải lên file nhỏ hơn 10MB.',
    severity: 'error',
  },
  {
    pattern: /timeout/i,
    type: 'TIMEOUT',
    english: 'Processing timed out. Please try again.',
    vietnamese: 'Xử lý quá thời gian. Vui lòng thử lại.',
    severity: 'warning',
  },
  {
    pattern: /pdf.*invalid|invalid.*pdf|corrupt.*pdf/i,
    type: 'PDF_INVALID',
    english: 'PDF file is invalid or corrupted.',
    vietnamese: 'Tệp PDF không hợp lệ hoặc bị hỏng.',
    severity: 'error',
  },
  {
    pattern: /pdf.*encrypt|password.*protect/i,
    type: 'PDF_ENCRYPTED',
    english: 'PDF file is password protected. Please remove the password before uploading.',
    vietnamese: 'Tệp PDF được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi tải lên.',
    severity: 'error',
  },
  {
    pattern: /pdf.*too.*large|pdf.*size/i,
    type: 'PDF_TOO_LARGE',
    english: 'PDF file is too large. Maximum size is 20MB.',
    vietnamese: 'Tệp PDF quá lớn (tối đa 20MB).',
    severity: 'error',
  },
  {
    pattern: /pdf.*conversion|convert.*pdf.*fail/i,
    type: 'PDF_CONVERSION_FAILED',
    english: 'Could not convert PDF. Please try again or upload an image.',
    vietnamese: 'Không thể chuyển đổi PDF. Vui lòng thử lại hoặc tải lên hình ảnh.',
    severity: 'error',
  },
]

/**
 * Get localized error message from technical error.
 * @param technicalError - Original error message from Gemini (nullable for safety)
 * @returns Localized error info with type, message, and severity
 */
export function getAIError(
  technicalError: string | null | undefined,
  language: 'EN' | 'VI' = 'EN'
): {
  type: AIErrorType
  message: string
  severity: 'info' | 'warning' | 'error'
} {
  // Input validation - handle null/undefined/empty
  const errorStr = technicalError?.toString().trim() || ''
  if (!errorStr) {
    return {
      type: 'UNKNOWN',
      message:
        language === 'VI'
          ? 'Không thể xử lý tài liệu. Vui lòng phân loại thủ công.'
          : 'Could not process document. Please classify it manually.',
      severity: 'warning',
    }
  }

  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(errorStr)) {
      return {
        type: mapping.type,
        message: language === 'VI' ? mapping.vietnamese : mapping.english,
        severity: mapping.severity,
      }
    }
  }

  // Default fallback for unrecognized errors
  return {
    type: 'UNKNOWN',
    message:
      language === 'VI'
        ? 'Không thể xử lý tài liệu. Vui lòng phân loại thủ công.'
        : 'Could not process document. Please classify it manually.',
    severity: 'warning',
  }
}

/**
 * Backward-compatible Vietnamese helper for older callers.
 */
export function getVietnameseError(technicalError: string | null | undefined) {
  return getAIError(technicalError, 'VI')
}

/**
 * Get action title based on error type.
 */
export function getActionTitle(errorType: AIErrorType, language: 'EN' | 'VI' = 'EN'): string {
  const englishTitles: Record<AIErrorType, string> = {
    MODEL_NOT_FOUND: 'AI model fallback needed',
    RATE_LIMIT: 'Waiting for processing',
    QUOTA_EXCEEDED: 'AI quota exceeded',
    SERVICE_UNAVAILABLE: 'AI unavailable',
    INVALID_IMAGE: 'Invalid image',
    IMAGE_TOO_LARGE: 'File too large',
    TIMEOUT: 'Processing timed out',
    CLASSIFICATION_FAILED: 'Automatic classification failed',
    OCR_FAILED: 'Data extraction failed',
    PDF_INVALID: 'Invalid PDF',
    PDF_ENCRYPTED: 'Protected PDF',
    PDF_TOO_LARGE: 'PDF too large',
    PDF_CONVERSION_FAILED: 'PDF conversion failed',
    UNKNOWN: 'AI processing error',
  }
  const vietnameseTitles: Record<AIErrorType, string> = {
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
  const titles = language === 'VI' ? vietnameseTitles : englishTitles
  return titles[errorType]
}

/**
 * Get action priority based on error severity
 */
export function getActionPriority(severity: 'info' | 'warning' | 'error'): 'NORMAL' | 'HIGH' {
  return severity === 'error' ? 'HIGH' : 'NORMAL'
}
