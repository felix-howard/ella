/**
 * Schedule C Business Summary — read-only view shown on an INDIVIDUAL detail page
 * when the individual has no own Schedule C but has ≥1 linked Schedule-C-eligible
 * business with a Schedule C record. Lists each business with a deep link to its
 * own Schedule C tab. No "Send" action here (avoids ambiguity per phase brief).
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
          {t('scheduleC.businessSummaryTitle', { defaultValue: 'Schedule C — linked businesses' })}
        </h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('scheduleC.businessSummaryDesc', {
          defaultValue:
            'This individual has Schedule C activity through linked businesses. Open a business to manage its Schedule C.',
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
