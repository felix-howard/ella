/**
 * Totals Card - Aggregate summary across all rental properties
 * Redesigned with prominent stat cards and clear visual hierarchy
 */
import { Building2, DollarSign, Receipt, TrendingUp, TrendingDown } from 'lucide-react'
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Property Count */}
      <div className="bg-muted/40 dark:bg-white/[0.04] rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">{t('scheduleE.propertyCount')}</p>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {totals.propertyCount}
        </p>
      </div>

      {/* Total Rent */}
      <div className="bg-muted/40 dark:bg-white/[0.04] rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-xs text-muted-foreground">{t('scheduleE.totalRent')}</p>
        </div>
        <CopyableValue
          formatted={formatUSD(totals.totalRent)}
          rawValue={totals.totalRent}
          className="text-2xl font-bold text-foreground"
        />
      </div>

      {/* Total Expenses */}
      <div className="bg-muted/40 dark:bg-white/[0.04] rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Receipt className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <p className="text-xs text-muted-foreground">{t('scheduleE.totalExpenses')}</p>
        </div>
        <CopyableValue
          formatted={formatUSD(totals.totalExpenses)}
          rawValue={totals.totalExpenses}
          className="text-2xl font-bold text-foreground"
        />
      </div>

      {/* Net Income - Highlighted */}
      <div className={cn(
        'rounded-xl p-4 border',
        netIsPositive
          ? 'bg-green-500/5 dark:bg-green-500/10 border-green-500/20'
          : 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center',
            netIsPositive ? 'bg-green-500/10' : 'bg-red-500/10'
          )}>
            {netIsPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('scheduleE.netIncome')}</p>
        </div>
        <CopyableValue
          formatted={formatUSD(totals.totalNet)}
          rawValue={totals.totalNet}
          className={cn(
            'text-2xl font-bold',
            netIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}
        />
      </div>
    </div>
  )
}
