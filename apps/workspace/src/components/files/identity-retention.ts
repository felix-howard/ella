import type { RawImage } from '../../lib/api-client'

const DAY_MS = 24 * 60 * 60 * 1000

export type RetentionImage = Pick<
  RawImage,
  'retentionDeleteAt' | 'retentionDeletedAt' | 'storageDeletedAt' | 'isStorageDeleted'
>

type RetentionState =
  | { kind: 'deleted'; deletedAt: Date | null }
  | { kind: 'active'; deleteAt: Date; daysRemaining: number; tone: 'neutral' | 'amber' | 'red' }

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isRetentionStorageDeleted(image: RetentionImage) {
  return Boolean(image.isStorageDeleted || image.retentionDeletedAt || image.storageDeletedAt)
}

export function getIdentityRetentionState(
  image: RetentionImage,
  now = new Date()
): RetentionState | null {
  if (isRetentionStorageDeleted(image)) {
    return { kind: 'deleted', deletedAt: parseDate(image.retentionDeletedAt ?? image.storageDeletedAt) }
  }

  const deleteAt = parseDate(image.retentionDeleteAt)
  if (!deleteAt) return null

  const daysRemaining = Math.max(0, Math.ceil((deleteAt.getTime() - now.getTime()) / DAY_MS))
  const tone = daysRemaining <= 3 ? 'red' : daysRemaining <= 14 ? 'amber' : 'neutral'
  return { kind: 'active', deleteAt, daysRemaining, tone }
}
