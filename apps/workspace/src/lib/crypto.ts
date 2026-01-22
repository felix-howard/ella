/**
 * SSN Display Utilities (Frontend Only)
 * Non-sensitive utilities for formatting and masking SSN in UI
 * Encryption/decryption is handled server-side for security
 */

/**
 * Mask SSN for display (e.g., "123-45-6789" -> "***-**-6789")
 * @param ssn - Plain SSN string
 * @returns Masked SSN showing only last 4 digits
 */
export function maskSSN(ssn: string): string {
  if (!ssn || ssn.trim() === '') return ''

  // Defensive sanitization: strip HTML chars to prevent XSS
  const sanitized = ssn.replace(/[<>'"&]/g, '')
  const digits = sanitized.replace(/\D/g, '')
  if (digits.length < 4) return '***-**-****'

  return `***-**-${digits.slice(-4)}`
}

/**
 * Format SSN with dashes (e.g., "123456789" -> "123-45-6789")
 * @param ssn - Raw SSN string (with or without dashes)
 * @returns Formatted SSN with dashes
 */
export function formatSSN(ssn: string): string {
  if (!ssn) return ''

  const digits = ssn.replace(/\D/g, '')
  if (digits.length !== 9) return ssn

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`
}

/**
 * Validate SSN format for form input
 * - Must be 9 digits
 * - Cannot start with 000, 666, or 9XX (invalid SSA prefixes)
 * - Middle two digits cannot be 00
 * - Last four digits cannot be 0000
 */
export function isValidSSN(ssn: string): boolean {
  if (!ssn) return false

  const digits = ssn.replace(/\D/g, '')
  if (digits.length !== 9) return false

  // Invalid area numbers
  const area = digits.slice(0, 3)
  if (area === '000' || area === '666' || area[0] === '9') return false

  // Invalid group number
  const group = digits.slice(3, 5)
  if (group === '00') return false

  // Invalid serial number
  const serial = digits.slice(5, 9)
  if (serial === '0000') return false

  return true
}

/**
 * Get validation error message for SSN
 * @param ssn - SSN input to validate
 * @returns Error message or null if valid
 */
export function getSSNValidationError(ssn: string): string | null {
  if (!ssn) return null // Empty is allowed (optional field)

  const digits = ssn.replace(/\D/g, '')

  if (digits.length !== 9) {
    return 'SSN phải có 9 chữ số'
  }

  const area = digits.slice(0, 3)
  if (area === '000') {
    return 'SSN không thể bắt đầu bằng 000'
  }
  if (area === '666') {
    return 'SSN không thể bắt đầu bằng 666'
  }
  if (area[0] === '9') {
    return 'SSN không thể bắt đầu bằng 9'
  }

  const group = digits.slice(3, 5)
  if (group === '00') {
    return 'Số nhóm SSN không hợp lệ (00)'
  }

  const serial = digits.slice(5, 9)
  if (serial === '0000') {
    return 'Số serial SSN không hợp lệ (0000)'
  }

  return null
}

/**
 * Format SSN input as user types (auto-add dashes)
 * @param input - Current input value
 * @returns Formatted input with dashes
 */
export function formatSSNInput(input: string): string {
  // Remove non-digits
  const digits = input.replace(/\D/g, '')

  // Limit to 9 digits
  const limited = digits.slice(0, 9)

  // Add dashes at appropriate positions
  if (limited.length <= 3) return limited
  if (limited.length <= 5) return `${limited.slice(0, 3)}-${limited.slice(3)}`
  return `${limited.slice(0, 3)}-${limited.slice(3, 5)}-${limited.slice(5)}`
}
