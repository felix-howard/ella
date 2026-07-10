import { AlertCircle, Clock3, Pencil, PlayCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, cn } from '@ella/ui'
import type { ClientServiceLog } from '../../../lib/api-client'
import {
  formatServiceDate,
  getServiceLogTitle,
  getStatusLabel,
  STATUS_BADGE_CLASS_NAMES,
} from './service-log-labels'

type ActiveServiceSummaryProps = {
  logs: ClientServiceLog[]
  onEdit: (log: ClientServiceLog) => void
}

export function ActiveServiceSummary({ logs, onEdit }: ActiveServiceSummaryProps) {
  const { i18n, t } = useTranslation()

  return (
    <section className="space-y-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('clientServices.activeTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {logs.length > 0
              ? t('clientServices.activeCount', { count: logs.length })
              : t('clientServices.activeEmptyDescription')}
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('clientServices.activeEmptyTitle')}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {logs.map((log) => {
            const isWaiting = log.status === 'WAITING_ON_CLIENT'
            const Icon = isWaiting ? AlertCircle : Clock3

            return (
              <article
                key={log.id}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  isWaiting ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20' : 'border-border bg-muted/20'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className={cn('h-4 w-4', isWaiting ? 'text-amber-600' : 'text-emerald-600')} />
                      <h3 className="text-sm font-semibold text-foreground">
                        {getServiceLogTitle(log, t)}
                      </h3>
                      <Badge className={STATUS_BADGE_CLASS_NAMES[log.status]}>
                        {getStatusLabel(log.status, t)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        log.taxYear ? t('clientServices.taxYearValue', { taxYear: log.taxYear }) : null,
                        formatServiceDate(log.serviceDate, i18n.language),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {log.note && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {log.note}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(log)}
                    aria-label={t('clientServices.editService')}
                    title={t('clientServices.editService')}
                    className="h-11 w-11 shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
