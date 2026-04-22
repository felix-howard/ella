/**
 * Shared Docs Validators
 * Title, filename, and PDF magic-byte validation helpers.
 */

// PDF magic bytes: %PDF
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46])

export const TITLE_MIN_LENGTH = 1
export const TITLE_MAX_LENGTH = 100
export const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB
export const SHARED_DOC_EXPIRY_DAYS = 14

export function sharedDocExpiryFromNow(): Date {
  return new Date(Date.now() + SHARED_DOC_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 404 | 410 = 400
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate section title: trim, require length 1-100.
 * Throws ValidationError with code INVALID_TITLE on failure.
 */
export function validateTitle(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('INVALID_TITLE', 'Title must be a string')
  }
  const trimmed = raw.trim()
  if (trimmed.length < TITLE_MIN_LENGTH) {
    throw new ValidationError('INVALID_TITLE', 'Title is required')
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw new ValidationError(
      'INVALID_TITLE',
      `Title must be at most ${TITLE_MAX_LENGTH} characters`
    )
  }
  return trimmed
}

/**
 * Sanitize filename to prevent path traversal and XSS.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_') // path separators
    .replace(/[<>:"|?*]/g, '_') // Windows reserved
    .replace(/\.\./g, '_') // directory traversal
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '') // control chars
    .trim()
    .slice(0, 255)
}

/**
 * Verify buffer starts with PDF magic bytes.
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}
