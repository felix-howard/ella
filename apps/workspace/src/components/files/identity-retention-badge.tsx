import { CalendarClock, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { getIdentityRetentionState, type RetentionImage } from './identity-retention'

export function IdentityRetentionBadge({ image }: { image: RetentionImage }) {
  const { t, i18n } = useTranslation()
  const state = getIdentityRetentionState(image)
  if (!state) return null

  const formatDate = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date)
      : t('files.retention.unknownDate')

  if (state.kind === 'deleted') {
    const deletedDate = formatDate(state.deletedAt)
    return (
      <span
        title={t('files.retention.deletedTitle', { date: deletedDate })}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-medium flex-shrink-0"
      >
        <ShieldOff className="w-2.5 h-2.5" />
        {t('files.retention.deleted')}
      </span>
    )
  }

  const deleteDate = formatDate(state.deleteAt)
  return (
    <span
      title={t('files.retention.activeTitle', { date: deleteDate })}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
        state.tone === 'red' && 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
        state.tone === 'amber' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        state.tone === 'neutral' && 'bg-muted text-muted-foreground'
      )}
    >
      <CalendarClock className="w-2.5 h-2.5" />
      {t('files.retention.days', { count: state.daysRemaining })}
    </span>
  )
}
