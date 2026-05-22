/**
 * Format utilities for Schedule E display
 */
import i18n from '../../../../lib/i18n'

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

const PROPERTY_TYPE_LABEL_KEYS: Record<number, string> = {
  1: 'scheduleE.propertyType.1',
  2: 'scheduleE.propertyType.2',
  3: 'scheduleE.propertyType.3',
  4: 'scheduleE.propertyType.4',
  5: 'scheduleE.propertyType.5',
  7: 'scheduleE.propertyType.7',
  8: 'scheduleE.propertyType.8',
}

/**
 * Get property type label based on type code
 */
export function getPropertyTypeLabel(type: number, lang: 'vi' | 'en' = 'vi'): string {
  return i18n.t(PROPERTY_TYPE_LABEL_KEYS[type] || PROPERTY_TYPE_LABEL_KEYS[8], { lng: lang })
}

/**
 * Format property address as single line
 */
export function formatAddress(address: { street: string; city: string; state: string; zip: string }): string {
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean)
  return parts.join(', ')
}
