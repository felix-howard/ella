/**
 * Formatting utilities for Ella Workspace
 * Centralized formatters for phone numbers, initials, dates, etc.
 */
import i18n from './i18n'

/**
 * Mask phone number showing only last 4 digits: *** ***-XXXX
 * Used for non-admin users to protect client privacy
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const last4 = cleaned.slice(-4)
  return `*** *** ${last4}`
}

/**
 * Format phone number to US format: (xxx) xxx-xxxx
 * Supports 10-digit and 11-digit (with country code) numbers
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  // Return original if not matching expected formats
  return phone
}

/**
 * Format phone number as user types: (123) 456-7890
 * Handles partial input and formats progressively
 * Returns formatted string for display in input field
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '')

  // Limit to 10 digits (US phone without country code)
  const limited = digits.slice(0, 10)

  if (limited.length === 0) return ''
  if (limited.length <= 3) return `(${limited}`
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
}

/**
 * Get initials from a full name
 * Returns first letter of first name + first letter of last name
 * Example: "Nguyễn Văn An" → "NA"
 */
export function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Get relative time with locale support
 * Example: "5 minutes ago" / "5 phút trước"
 */
export function getRelativeTime(date: Date, locale: 'en' | 'vi' = 'vi'): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (locale === 'en') {
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    })
  }

  // Vietnamese (default)
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  return date.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Get relative time in Vietnamese (backwards compatible)
 * @deprecated Use getRelativeTime(date, 'vi') instead
 */
export function getRelativeTimeVi(date: Date): string {
  return getRelativeTime(date, 'vi')
}

/**
 * Copy text to clipboard with error handling
 * Returns true if successful, false if failed
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Format Vietnamese currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

/**
 * Format date in Vietnamese locale
 */
export function formatDateVi(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', options || {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Sanitize text to prevent XSS - strips HTML tags and entities
 * Use for displaying user-generated content
 */
export function sanitizeText(text: string): string {
  if (!text) return ''
  // Create a temporary element to decode HTML entities and strip tags
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return doc.body.textContent || ''
}

/**
 * Split text into segments of plain text and URLs
 * Returns an array of { type, value } for rendering
 */
export function linkifyText(text: string): Array<{ type: 'text' | 'link'; value: string }> {
  if (!text) return []
  const urlRegex = /(https?:\/\/[^\s<>'"]+)/g
  const parts: Array<{ type: 'text' | 'link'; value: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

/**
 * Strip HTML tags from input - for cleaning user input before sending
 */
export function stripHtmlTags(text: string): string {
  if (!text) return ''
  return text.replace(/<[^>]*>/g, '')
}

/**
 * Format concise relative time: "25 min", "2 hrs", "3 days", "2 months"
 */
export function formatShortRelativeTime(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin} min`
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''}`
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''}`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`
  return `${diffYears} yr${diffYears > 1 ? 's' : ''}`
}

/**
 * Format relative time from ISO string with locale support
 */
export function formatRelativeTime(isoString: string, locale?: string): string {
  const resolved = locale ?? i18n.language ?? 'vi'
  const lang = resolved.toLowerCase().startsWith('en') ? 'en' : 'vi'
  return getRelativeTime(new Date(isoString), lang)
}

/**
 * Format full date-time for tooltip display
 * Example: "Wed, Mar 25, 9:06 AM"
 */
export function formatFullDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format bytes to human-readable size (e.g., "2.4 MB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Avatar color palette - colors that work well on dark backgrounds
 * Each color has a bg (background) and text color
 */
const AVATAR_COLORS = [
  { bg: 'bg-emerald-500', text: 'text-white' },
  { bg: 'bg-blue-500', text: 'text-white' },
  { bg: 'bg-purple-500', text: 'text-white' },
  { bg: 'bg-pink-500', text: 'text-white' },
  { bg: 'bg-orange-500', text: 'text-white' },
  { bg: 'bg-teal-500', text: 'text-white' },
  { bg: 'bg-indigo-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
  { bg: 'bg-cyan-500', text: 'text-white' },
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-lime-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
] as const

/**
 * Generate consistent avatar color based on name
 * Same name will always return the same color
 */
export function getAvatarColor(name: string): { bg: string; text: string } {
  if (!name) return AVATAR_COLORS[0]

  // Simple hash function to get consistent index from name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32bit integer
  }

  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}
