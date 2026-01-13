/**
 * Validation Utilities
 * Input sanitization and file validation helpers
 */
import { config } from './config'

/**
 * Sanitize search input to prevent injection attacks
 * Removes special characters that could be used for SQL/NoSQL injection
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return ''

  // Remove or escape potentially dangerous characters
  // Keep alphanumeric, spaces, basic punctuation for names/emails/phones
  return input
    .trim()
    .slice(0, 100) // Limit length
    .replace(/[<>{}[\]\\^`|]/g, '') // Remove dangerous chars
    .replace(/['";]/g, '') // Remove SQL injection chars
    .replace(/\$/g, '') // Remove NoSQL injection char
}

/**
 * File upload validation result
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
  errorCode?: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'TOO_MANY_FILES' | 'NO_FILES'
}

/**
 * Validate uploaded files for type and size
 */
export function validateUploadedFiles(files: File[]): FileValidationResult {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: 'No files provided',
      errorCode: 'NO_FILES',
    }
  }

  if (files.length > config.upload.maxFilesPerUpload) {
    return {
      valid: false,
      error: `Maximum ${config.upload.maxFilesPerUpload} files allowed per upload`,
      errorCode: 'TOO_MANY_FILES',
    }
  }

  for (const file of files) {
    // Check file size
    if (file.size > config.upload.maxFileSize) {
      const maxMB = Math.round(config.upload.maxFileSize / 1024 / 1024)
      return {
        valid: false,
        error: `File "${file.name}" exceeds maximum size of ${maxMB}MB`,
        errorCode: 'FILE_TOO_LARGE',
      }
    }

    // Check mime type
    const mimeType = file.type || 'application/octet-stream'
    if (!config.upload.allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type "${mimeType}" is not allowed. Allowed: images (JPEG, PNG, WebP, HEIC) and PDF`,
        errorCode: 'INVALID_TYPE',
      }
    }
  }

  return { valid: true }
}

/**
 * Pick only allowed fields from an object (prevents mass assignment)
 */
export function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  allowedFields: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const field of allowedFields) {
    if (field in obj) {
      result[field] = obj[field]
    }
  }
  return result
}
