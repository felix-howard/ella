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
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-sm font-medium text-foreground">
            {isProfit ? t('scheduleC.netProfit') : t('scheduleC.netLoss')}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('scheduleC.scheduleCLine31')}
          </p>
        </div>
        <CopyableValue
          formatted={formatUSD(netProfit)}
          rawValue={netProfit}
          className="text-lg font-semibold text-foreground"
        />
      </div>
    </div>
  )
}
