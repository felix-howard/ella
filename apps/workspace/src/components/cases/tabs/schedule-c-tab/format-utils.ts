/**
 * Format utilities for Schedule C display
 */

/**
 * Format number as USD currency
 */
export function formatUSD(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Parse string value to number
 */
export function parseAmount(value: string | null | undefined): number {
  if (!value) return 0
  const num = parseFloat(value)
  return isNaN(num) ? 0 : num
}

/**
 * Check if value is positive (greater than 0)
 */
export function isPositive(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && num > 0
}

/**
 * Shared date format options for Schedule C
 */
export const DATE_FORMAT = {
  // Full datetime: "28 thg 1, 2026, 23:30"
  DATETIME_FULL: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  } as const,
  // Date only: "28 thg 1, 2026"
  DATE_ONLY: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  } as const,
  // Short date with time: "28 thg 1, 23:30"
  SHORT_DATETIME: {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  } as const,
}

/**
 * Format date string to Vietnamese locale
 */
export function formatDateTime(
  dateString: string | null | undefined,
  format: keyof typeof DATE_FORMAT = 'DATETIME_FULL'
): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', DATE_FORMAT[format])
  } catch {
    return 'N/A'
  }
}
