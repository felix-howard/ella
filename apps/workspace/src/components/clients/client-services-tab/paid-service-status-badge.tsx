import { cn } from '@ella/ui'
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  RefreshCcw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientPaidServiceStatus } from '../../../lib/api-client'

const statusStyles: Record<ClientPaidServiceStatus, string> = {
  PAID:
    'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  ACTIVE:
    'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300',
  PAST_DUE:
    'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  ENDED:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  REFUNDED:
    'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

const statusIcons: Record<ClientPaidServiceStatus, LucideIcon> = {
  PAID: CheckCircle2,
  ACTIVE: ShieldCheck,
  PAST_DUE: AlertTriangle,
  ENDED: CircleOff,
  REFUNDED: RefreshCcw,
}

export function PaidServiceStatusBadge({ status }: { status: ClientPaidServiceStatus }) {
  const { t } = useTranslation()
  const Icon = statusIcons[status]

  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`clientServices.status.${status}`)}
    </span>
  )
}
