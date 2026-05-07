/**
 * Pure helpers for displaying an agreement's link expiry on cards + modals.
 * Returns a compact status object so consumers can pick label + tone without
 * recomputing diffs at the call site.
 */
import type { Agreement } from '../../lib/api-client'

export type ExpiryKind = 'safe' | 'soon' | 'expired' | 'na'

export interface ExpiryStatus {
  /** Drives the visual tone (color). 'na' = caller should hide the row. */
  kind: ExpiryKind
  /** Localized short label, e.g. "Expires in 5 days" / "Expired 2 days ago". */
  label: string
  /** Absolute date for tooltip / secondary line, e.g. "May 14, 2026". null when 'na'. */
  fullDate: string | null
  /** Days remaining (negative = expired). null when 'na'. */
  daysRemaining: number | null
}

/** Threshold in days for the amber "expiring soon" tone. */
const SOON_THRESHOLD_DAYS = 2
const MS_PER_DAY = 86_400_000

function diffDays(future: Date, now: Date): number {
  return Math.ceil((future.getTime() - now.getTime()) / MS_PER_DAY)
}

function formatAbsolute(d: Date, locale: string): string {
  const isVi = locale.toLowerCase().startsWith('vi')
  return d.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Compute display status for an agreement's link expiry.
 *
 * Returns 'na' when the expiry is no longer relevant — signed agreements,
 * voided agreements, or rows missing `expiresAt`. The card should hide the
 * expiry row entirely in those cases.
 */
export function getExpiryStatus(
  nda: Agreement,
  locale: string,
  now: Date = new Date(),
): ExpiryStatus {
  if (
    nda.status === 'SIGNED' ||
    nda.status === 'VOIDED' ||
    !nda.expiresAt ||
    !nda.isActive
  ) {
    return { kind: 'na', label: '', fullDate: null, daysRemaining: null }
  }

  const expiresAt = new Date(nda.expiresAt)
  const days = diffDays(expiresAt, now)
  const isVi = locale.toLowerCase().startsWith('vi')
  const fullDate = formatAbsolute(expiresAt, locale)

  if (days <= 0) {
    const past = Math.abs(days)
    const label = isVi
      ? past === 0
        ? 'Đã hết hạn'
        : `Hết hạn ${past} ngày trước`
      : past === 0
        ? 'Expired today'
        : `Expired ${past} day${past === 1 ? '' : 's'} ago`
    return { kind: 'expired', label, fullDate, daysRemaining: days }
  }

  const label = isVi
    ? `Hết hạn sau ${days} ngày`
    : `Expires in ${days} day${days === 1 ? '' : 's'}`
  const kind: ExpiryKind = days <= SOON_THRESHOLD_DAYS ? 'soon' : 'safe'
  return { kind, label, fullDate, daysRemaining: days }
}

/** Tailwind text-color class for each tone. */
export function expiryToneClass(kind: ExpiryKind): string {
  switch (kind) {
    case 'expired':
      return 'text-destructive'
    case 'soon':
      return 'text-amber-600 dark:text-amber-500'
    default:
      return 'text-foreground'
  }
}
