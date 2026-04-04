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
    className: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
  SUBMITTED: {
    i18nKey: 'scheduleE.statusSubmitted',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 ring-1 ring-green-500/20',
  },
  LOCKED: {
    i18nKey: 'scheduleE.statusLocked',
    icon: Lock,
    className: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
      config.className
    )}>
      <Icon className="w-3.5 h-3.5" />
      {t(config.i18nKey)}
    </span>
  )
}
