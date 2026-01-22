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

// Color config for badge styling (semantic colors + dark mode)
const BADGE_COLORS: Record<BadgeType, string> = {
  missing: 'bg-error/10 text-error border-error/20',
  verify: 'bg-warning/10 text-warning border-warning/20',
  entry: 'bg-primary/10 text-primary border-primary/20',
  stale: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  ready: 'bg-success/10 text-success border-success/20',
  'new-activity': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
} as const

export const ActionBadge = memo(function ActionBadge({ type, count, days }: ActionBadgeProps) {
  const baseLabel = ACTION_BADGE_LABELS[type]
  const ariaBase = ACTION_BADGE_ARIA_LABELS[type]
  const color = BADGE_COLORS[type]

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
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
        color
      )}
    >
      {label}
    </span>
  )
})
