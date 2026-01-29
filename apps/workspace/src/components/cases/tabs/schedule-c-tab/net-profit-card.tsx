/**
 * Net Profit Card - Highlighted display of net profit/loss
 * Green for profit, red for loss
 */
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@ella/ui'
import { formatUSD, parseAmount } from './format-utils'
import { CopyableValue } from './copyable-value'

interface NetProfitCardProps {
  netProfit: string | number
}

export function NetProfitCard({ netProfit }: NetProfitCardProps) {
  const amount = parseAmount(netProfit as string)
  const isProfit = amount >= 0
  const Icon = isProfit ? TrendingUp : TrendingDown

  return (
    <div className={cn(
      'rounded-lg p-4 border',
      isProfit
        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            'w-5 h-5',
            isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )} />
          <span className={cn(
            'text-sm font-medium',
            isProfit ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
          )}>
            {isProfit ? 'LỢI NHUẬN RÒNG' : 'LỖ RÒNG'}
          </span>
        </div>
        <CopyableValue
          formatted={formatUSD(netProfit)}
          rawValue={netProfit}
          className={cn(
            'text-xl font-bold',
            isProfit ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Schedule C Dòng 31 (Thu nhập gộp - Tổng chi phí)
      </p>
    </div>
  )
}
