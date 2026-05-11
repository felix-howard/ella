/**
 * Compact linked-business Schedule C list shown below an individual's own
 * Schedule C activity.
 */
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientPreview } from '../../../../lib/api-client'
import { ScheduleCBusinessSummaryRow } from './schedule-c-business-summary-row'

interface ScheduleCBusinessSummaryListProps {
  businesses: ClientPreview[]
}

export function ScheduleCBusinessSummaryList({ businesses }: ScheduleCBusinessSummaryListProps) {
  const { t } = useTranslation()

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">
          {t('scheduleC.businessSummaryTitle', { defaultValue: 'Linked business Schedule C' })}
        </h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('scheduleC.businessSummaryDesc', {
          defaultValue:
            'Open a linked business to manage its own Schedule C.',
        })}
      </p>
      <div className="flex flex-col gap-2">
        {businesses.map((biz) => (
          <ScheduleCBusinessSummaryRow key={biz.id} business={biz} />
        ))}
      </div>
    </div>
  )
}
