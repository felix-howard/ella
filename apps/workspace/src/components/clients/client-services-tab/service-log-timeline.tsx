import type { ReactNode } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientServiceLog } from '../../../lib/api-client'
import { ServiceLogRow } from './service-log-row'

type ServiceLogTimelineProps = {
  logs: ClientServiceLog[]
  onEdit: (log: ClientServiceLog) => void
  action?: ReactNode
}

export function ServiceLogTimeline({ logs, onEdit, action }: ServiceLogTimelineProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('clientServices.historyTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('clientServices.historyDescription')}
          </p>
        </div>
        {action}
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <BriefcaseBusiness className="mb-3 h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{t('clientServices.emptyTitle')}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t('clientServices.emptyDescription')}
          </p>
        </div>
      ) : (
        <ol>
          {logs.map((log, index) => (
            <ServiceLogRow
              key={log.id}
              log={log}
              showConnector={index < logs.length - 1}
              onEdit={onEdit}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
