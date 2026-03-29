/**
 * Lead Status Badge - Color-coded status indicator
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

interface LeadStatusBadgeProps {
  status: LeadStatus
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const { t } = useTranslation()

  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
      STATUS_STYLES[status]
    )}>
      {t(`leads.status.${status}`)}
    </span>
  )
}
