/**
 * Computed Status Badge Component
 * Read-only display of computed case status
 * Used in client list table and client detail page header
 */

import { cn } from '@ella/ui'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '../../lib/constants'
import type { TaxCaseStatus } from '../../lib/api-client'

interface ComputedStatusBadgeProps {
  status: TaxCaseStatus | null
  size?: 'sm' | 'md'
}

export function ComputedStatusBadge({ status, size = 'md' }: ComputedStatusBadgeProps) {
  if (!status) {
    return (
      <span className="text-xs text-muted-foreground">Chưa có hồ sơ</span>
    )
  }

  const colors = CASE_STATUS_COLORS[status]
  const label = CASE_STATUS_LABELS[status]

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        colors?.bg || 'bg-muted',
        colors?.text || 'text-muted-foreground',
        colors?.border || 'border-border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {label}
    </span>
  )
}
