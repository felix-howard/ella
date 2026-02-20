/**
 * Format utilities for Schedule E display
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
 * Shared date format options for Schedule E
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
 * Format date string based on locale
 */
export function formatDateTime(
  dateString: string | null | undefined,
  format: keyof typeof DATE_FORMAT = 'DATETIME_FULL',
  locale: string = 'en-US'
): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale, DATE_FORMAT[format])
  } catch {
    return 'N/A'
  }
}

/**
 * Property type labels for display (Vietnamese + English)
 */
export const PROPERTY_TYPE_LABELS: Record<number, { en: string; vi: string }> = {
  1: { en: 'Single Family Residence', vi: 'Nhà riêng lẻ' },
  2: { en: 'Multi-Family Residence', vi: 'Nhà nhiều căn hộ' },
  3: { en: 'Vacation/Short-Term Rental', vi: 'Cho thuê ngắn hạn' },
  4: { en: 'Commercial', vi: 'Thương mại' },
  5: { en: 'Land', vi: 'Đất trống' },
  7: { en: 'Self-Rental', vi: 'Tự cho thuê' },
  8: { en: 'Other', vi: 'Khác' },
}

/**
 * Get property type label based on type code
 */
export function getPropertyTypeLabel(type: number, lang: 'vi' | 'en' = 'vi'): string {
  return PROPERTY_TYPE_LABELS[type]?.[lang] || PROPERTY_TYPE_LABELS[8][lang]
}

/**
 * Format property address as single line
 */
export function formatAddress(address: { street: string; city: string; state: string; zip: string }): string {
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean)
  return parts.join(', ')
}
