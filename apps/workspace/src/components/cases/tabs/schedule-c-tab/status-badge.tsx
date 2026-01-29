/**
 * Status Badge - Shows Schedule C status with appropriate styling
 */
import { Clock, CheckCircle2, Lock } from 'lucide-react'
import { cn } from '@ella/ui'
import type { ScheduleCStatus } from '../../../../lib/api-client'

interface StatusBadgeProps {
  status: ScheduleCStatus
}

const STATUS_CONFIG: Record<ScheduleCStatus, {
  label: string
  icon: typeof Clock
  className: string
}> = {
  DRAFT: {
    label: 'Đang chờ',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  },
  SUBMITTED: {
    label: 'Đã gửi',
    icon: CheckCircle2,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  },
  LOCKED: {
    label: 'Đã khóa',
    icon: Lock,
    className: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.className
    )}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}
