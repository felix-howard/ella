/**
 * ChecklistProgress - Visual progress bar for checklist completion
 * Shows received/total documents with percentage
 * Excludes NOT_REQUIRED items from total count
 */

import { cn, ProgressBar } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ChecklistItem } from '../../lib/api-client'

export interface ChecklistProgressProps {
  items: ChecklistItem[]
  className?: string
  showDetails?: boolean
}

export function ChecklistProgress({ items, className, showDetails = true }: ChecklistProgressProps) {
  const { t } = useTranslation()
  // Exclude NOT_REQUIRED items from total count
  const activeItems = items.filter(i => i.status !== 'NOT_REQUIRED')
  const total = activeItems.length
  const received = activeItems.filter(i =>
    ['HAS_RAW', 'HAS_DIGITAL', 'VERIFIED'].includes(i.status)
  ).length
  const verified = activeItems.filter(i => i.status === 'VERIFIED').length
  const percentage = total > 0 ? Math.round((received / total) * 100) : 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-foreground">
          {t('checklistProgress.received', { received, total })}
        </span>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <ProgressBar value={received} max={total} size="default" />
      {showDetails && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{t('checklistProgress.verified', { count: verified })}</span>
          <span>{t('checklistProgress.missing', { count: total - received })}</span>
        </div>
      )}
    </div>
  )
}
