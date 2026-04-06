/**
 * Net Profit Card - Subtle display of net profit/loss with brand color
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { formatUSD, parseAmount } from './format-utils'
import { CopyableValue } from './copyable-value'

interface NetProfitCardProps {
  netProfit: string | number
}

export function NetProfitCard({ netProfit }: NetProfitCardProps) {
  const { t } = useTranslation()
  const amount = parseAmount(netProfit as string)
  const isProfit = amount >= 0

  return (
    <div className="border-t border-border pt-4">
      <div className={cn(
        'rounded-lg px-3 py-2.5 flex items-center justify-between',
        isProfit
          ? 'bg-primary/5 border border-primary/15'
          : 'bg-destructive/5 border border-destructive/15'
      )}>
        <div>
          <span className={cn(
            'text-sm font-medium uppercase tracking-wide',
            isProfit ? 'text-primary' : 'text-destructive'
          )}>
            {isProfit ? t('scheduleC.netProfit') : t('scheduleC.netLoss')}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('scheduleC.scheduleCLine31')}
          </p>
        </div>
        <CopyableValue
          formatted={formatUSD(netProfit)}
          rawValue={netProfit}
          className={cn(
            'text-lg font-semibold',
            isProfit ? 'text-primary' : 'text-destructive'
          )}
        />
      </div>
    </div>
  )
}
