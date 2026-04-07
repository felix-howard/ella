/**
 * Lead Status Badge - Color-coded status indicator with badge and dot variants
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { LeadStatus } from '../../lib/api-client'

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  CONVERTED: 'bg-green-100 text-green-700',
  LOST: 'bg-gray-100 text-gray-600',
}

const DOT_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-yellow-500',
  CONVERTED: 'bg-green-500',
  LOST: 'bg-gray-400',
}

interface LeadStatusBadgeProps {
  status: LeadStatus
  variant?: 'badge' | 'dot'
}

export function LeadStatusBadge({ status, variant = 'badge' }: LeadStatusBadgeProps) {
  const { t } = useTranslation()

  if (variant === 'dot') {
    return (
      <span className="flex items-center gap-2" role="status" aria-label={t(`leads.status.${status}`)}>
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_COLORS[status])} aria-hidden="true" />
        <span className="text-sm text-foreground">{t(`leads.status.${status}`)}</span>
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
      STATUS_STYLES[status]
    )}>
      {t(`leads.status.${status}`)}
    </span>
  )
}
