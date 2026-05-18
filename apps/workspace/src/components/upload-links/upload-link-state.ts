import type { UploadLinkData } from '../../lib/api-client'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(expires)) return null
  return Math.round((expires - Date.now()) / MS_PER_DAY)
}

export function isUploadLinkExpiringSoon(link: UploadLinkData | null): boolean {
  if (!link || link.status !== 'ACTIVE') return false
  const days = getDaysUntilExpiry(link.expiresAt)
  return days !== null && days <= 3
}
