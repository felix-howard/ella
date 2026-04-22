/**
 * ExpiryBadge - Renders link expiry status as a compact chip/label.
 * - near-expiry (≤3 days): amber warning chip
 * - expired: red "Expired {date}" label
 * - never expires: muted "Never expires" label
 * - otherwise: clock icon + "Expires in N days" text
 */
import { useTranslation } from 'react-i18next'
import { Clock, AlertTriangle } from 'lucide-react'
import type { LinkStateResult } from './compute-link-state'

interface ExpiryBadgeProps {
  result: LinkStateResult
  language: string
}

function formatDate(date: Date | null, language: string): string {
  if (!date) return '-'
  return date.toLocaleDateString(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ExpiryBadge({ result, language }: ExpiryBadgeProps) {
  const { t } = useTranslation()
  const { state, daysUntilExpiry, isNearExpiry, expiresAt } = result

  if (state === 'expired') {
    return (
      <span className="text-xs text-destructive font-medium">
        {t('sharedDocs.linkState.expired', { date: formatDate(expiresAt, language) })}
      </span>
    )
  }

  if (state !== 'active') return null

  if (!expiresAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        {t('sharedDocs.extend.never')}
      </span>
    )
  }

  if (isNearExpiry) {
    const days = Math.max(0, daysUntilExpiry ?? 0)
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-medium">
        <AlertTriangle className="w-3 h-3" />
        {t('sharedDocs.expiry.near', { days })}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      {t('sharedDocs.expiresIn', { days: daysUntilExpiry ?? 0 })}
    </span>
  )
}
