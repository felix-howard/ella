/**
 * Single row of the lead activity timeline: colored dot + icon, title, optional subtitle, relative time.
 * The caller controls whether a vertical connector line renders beneath this row.
 */
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { formatShortRelativeTime } from '../../../lib/formatters'
import type { TimelineEventColor } from '../../../lib/derive-lead-activity-events'

interface Props {
  icon: LucideIcon
  color: TimelineEventColor
  title: string
  subtitle?: string
  timestamp: string
  showConnector: boolean
}

const COLOR_CLASSES: Record<TimelineEventColor, string> = {
  mint: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  coral: 'bg-rose-100 text-rose-700 ring-rose-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  gray: 'bg-muted text-muted-foreground ring-border',
}

export function TimelineRow({ icon: Icon, color, title, subtitle, timestamp, showConnector }: Props) {
  const { i18n } = useTranslation()

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {showConnector && (
        <span className="absolute left-3 top-7 bottom-0 w-px bg-border/60" aria-hidden="true" />
      )}
      <span
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${COLOR_CLASSES[color]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          <time dateTime={timestamp} className="text-xs text-muted-foreground shrink-0">
            {formatShortRelativeTime(timestamp, i18n.language)}
          </time>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </li>
  )
}
