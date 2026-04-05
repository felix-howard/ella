/**
 * Totals Card - Inline summary row for aggregate rental property data
 */
import { useTranslation } from 'react-i18next'
import type { ScheduleETotals } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'
import { CopyableValue } from './copyable-value'

interface TotalsCardProps {
  totals: ScheduleETotals
}

export function TotalsCard({ totals }: TotalsCardProps) {
  const { t } = useTranslation()

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.propertyCount')}</p>
          <p className="text-sm font-semibold text-foreground tabular-nums">{totals.propertyCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.totalRent')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalRent)}
            rawValue={totals.totalRent}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.totalExpenses')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalExpenses)}
            rawValue={totals.totalExpenses}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.netIncome')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalNet)}
            rawValue={totals.totalNet}
            className="text-sm font-semibold text-foreground"
          />
        </div>
      </div>
    </div>
  )
}
