/**
 * Status Badge - Shows Schedule E status with appropriate styling
 */
import { Clock, CheckCircle2, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ScheduleEStatus } from '../../../../lib/api-client'

interface StatusBadgeProps {
  status: ScheduleEStatus
}

const STATUS_CONFIG: Record<ScheduleEStatus, {
  i18nKey: string
  icon: typeof Clock
  className: string
}> = {
  DRAFT: {
    i18nKey: 'scheduleE.statusDraft',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  },
  SUBMITTED: {
    i18nKey: 'scheduleE.statusSubmitted',
    icon: CheckCircle2,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  },
  LOCKED: {
    i18nKey: 'scheduleE.statusLocked',
    icon: Lock,
    className: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.className
    )}>
      <Icon className="w-3.5 h-3.5" />
      {t(config.i18nKey)}
    </span>
  )
}
