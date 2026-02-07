/**
 * Totals Card - Aggregate summary across all rental properties
 * Shows total rent, expenses, and net income with visual indicators
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ScheduleETotals } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'
import { CopyableValue } from './copyable-value'

interface TotalsCardProps {
  totals: ScheduleETotals
}

export function TotalsCard({ totals }: TotalsCardProps) {
  const { t } = useTranslation()
  const netIsPositive = totals.totalNet >= 0

  return (
    <div className="bg-muted/50 rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
        {t('scheduleE.aggregateTotals')}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Property Count */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.propertyCount')}</p>
          <p className="text-lg font-semibold text-foreground">
            {totals.propertyCount}
          </p>
        </div>

        {/* Total Rent */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.totalRent')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalRent)}
            rawValue={totals.totalRent}
            className="text-lg font-semibold text-foreground"
          />
        </div>

        {/* Total Expenses */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.totalExpenses')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalExpenses)}
            rawValue={totals.totalExpenses}
            className="text-lg font-semibold text-foreground"
          />
        </div>

        {/* Net Income */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('scheduleE.netIncome')}</p>
          <CopyableValue
            formatted={formatUSD(totals.totalNet)}
            rawValue={totals.totalNet}
            className={cn(
              'text-lg font-semibold',
              netIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
          />
        </div>
      </div>
    </div>
  )
}
