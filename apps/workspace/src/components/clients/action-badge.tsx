/**
 * Action Badge Component
 * Displays actionable indicators for client list
 * Shows counts for missing docs, verification needed, data entry needed, stale cases
 */

import { memo } from 'react'
import { cn } from '@ella/ui'
import { ACTION_BADGE_LABELS, ACTION_BADGE_ARIA_LABELS, TIME_FORMATS } from '../../lib/constants'

export type BadgeType = keyof typeof ACTION_BADGE_LABELS

interface ActionBadgeProps {
  type: BadgeType
  count?: number
  days?: number
}

// Dot color per badge type
const BADGE_DOT_COLORS: Record<BadgeType, string> = {
  missing: 'bg-red-500',
  verify: 'bg-amber-500',
  entry: 'bg-blue-500',
  stale: 'bg-slate-400 dark:bg-slate-500',
  ready: 'bg-emerald-500',
  'new-activity': 'bg-purple-500',
  'need-upload-link': 'bg-rose-500',
} as const

export const ActionBadge = memo(function ActionBadge({ type, count, days }: ActionBadgeProps) {
  const baseLabel = ACTION_BADGE_LABELS[type]
  const ariaBase = ACTION_BADGE_ARIA_LABELS[type]
  const dotColor = BADGE_DOT_COLORS[type]

  // Build label and aria-label based on type
  let label: string
  let ariaLabel: string
  if (type === 'stale' && days !== undefined) {
    label = `${TIME_FORMATS.daysShort(days)} ${baseLabel}`
    ariaLabel = `${TIME_FORMATS.daysFull(days)} ${ariaBase}`
  } else if (count !== undefined && count > 0) {
    label = `${count} ${baseLabel}`
    ariaLabel = `${count} ${ariaBase}`
  } else {
    label = baseLabel
    ariaLabel = ariaBase
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground"
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
      {label}
    </span>
  )
})
