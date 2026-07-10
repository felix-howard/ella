import { CalendarDays, Pencil, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, cn } from '@ella/ui'
import type { ClientServiceLog } from '../../../lib/api-client'
import {
  formatServiceDate,
  getServiceLogTitle,
  getStatusLabel,
  STATUS_BADGE_CLASS_NAMES,
} from './service-log-labels'

type ServiceLogRowProps = {
  log: ClientServiceLog
  showConnector: boolean
  onEdit: (log: ClientServiceLog) => void
}

export function ServiceLogRow({ log, showConnector, onEdit }: ServiceLogRowProps) {
  const { i18n, t } = useTranslation()
  const staffName = log.updatedBy?.name || log.createdBy?.name || t('clientServices.unknownStaff')

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {showConnector && (
        <span className="absolute bottom-0 left-4 top-9 w-px bg-border" aria-hidden="true" />
      )}
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </span>

      <article className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {getServiceLogTitle(log, t)}
              </h3>
              <Badge className={STATUS_BADGE_CLASS_NAMES[log.status]}>
                {getStatusLabel(log.status, t)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatServiceDate(log.serviceDate, i18n.language)}</span>
              {log.taxYear && (
                <span>{t('clientServices.taxYearValue', { taxYear: log.taxYear })}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3 w-3" aria-hidden="true" />
                {staffName}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onEdit(log)}
            className="min-h-11 shrink-0 px-4"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {t('clientServices.edit')}
          </Button>
        </div>

        {log.note && (
          <p
            className={cn(
              'mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-sm text-foreground [overflow-wrap:anywhere]'
            )}
          >
            {log.note}
          </p>
        )}
      </article>
    </li>
  )
}
