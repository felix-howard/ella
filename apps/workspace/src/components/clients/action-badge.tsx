/**
 * Action Badge Component
 * Displays actionable indicators for client list
 * Shows counts for missing docs, verification needed, data entry needed, stale cases
 */

import { memo } from 'react'
import { cn } from '@ella/ui'

type BadgeType = 'missing' | 'verify' | 'entry' | 'stale' | 'ready' | 'new-activity'

interface ActionBadgeProps {
  type: BadgeType
  count?: number
  days?: number
}

const BADGE_CONFIG: Record<BadgeType, { label: string; ariaLabel: string; color: string }> = {
  missing: {
    label: 'thiếu',
    ariaLabel: 'Tài liệu còn thiếu',
    color: 'bg-error/10 text-error border-error/20',
  },
  verify: {
    label: 'cần xác minh',
    ariaLabel: 'Tài liệu cần xác minh',
    color: 'bg-warning/10 text-warning border-warning/20',
  },
  entry: {
    label: 'cần nhập',
    ariaLabel: 'Tài liệu cần nhập liệu',
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  stale: {
    label: 'không hoạt động',
    ariaLabel: 'Hồ sơ không hoạt động',
    color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  },
  ready: {
    label: 'Sẵn sàng',
    ariaLabel: 'Sẵn sàng kiểm tra',
    color: 'bg-success/10 text-success border-success/20',
  },
  'new-activity': {
    label: 'Mới',
    ariaLabel: 'Có hoạt động mới',
    color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  },
}

export const ActionBadge = memo(function ActionBadge({ type, count, days }: ActionBadgeProps) {
  const config = BADGE_CONFIG[type]

  // Build label and aria-label based on type
  let label: string
  let ariaLabel: string
  if (type === 'stale' && days !== undefined) {
    label = `${days}d ${config.label}`
    ariaLabel = `${days} ngày ${config.ariaLabel}`
  } else if (count !== undefined && count > 0) {
    label = `${count} ${config.label}`
    ariaLabel = `${count} ${config.ariaLabel}`
  } else {
    label = config.label
    ariaLabel = config.ariaLabel
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
        config.color
      )}
    >
      {label}
    </span>
  )
})
