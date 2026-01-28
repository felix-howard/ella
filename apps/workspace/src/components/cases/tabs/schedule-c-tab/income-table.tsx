/**
 * Income Table - Displays Schedule C Part I income breakdown
 */
import type { ScheduleCExpense, ScheduleCTotals } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'

interface IncomeTableProps {
  expense: ScheduleCExpense
  totals?: ScheduleCTotals | null
  showGrossIncome?: boolean
}

export function IncomeTable({ expense, totals, showGrossIncome = false }: IncomeTableProps) {
  const rows = [
    { label: 'Tổng thu (từ 1099-NEC)', value: expense.grossReceipts },
    { label: 'Trả hàng và giảm giá', value: expense.returns },
    { label: 'Giá vốn hàng bán', value: expense.costOfGoods },
    { label: 'Thu nhập khác', value: expense.otherIncome },
  ]

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        // Skip if value is null/0 (except grossReceipts which should always show)
        const numValue = parseFloat(row.value || '0')
        if (row.label !== 'Tổng thu (từ 1099-NEC)' && numValue === 0) return null

        return (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatUSD(row.value)}
            </span>
          </div>
        )
      })}

      {/* Gross Income Total (if requested) */}
      {showGrossIncome && totals && (
        <div className="flex justify-between text-sm pt-2 mt-2 border-t border-border">
          <span className="font-medium text-foreground">THU NHẬP GỘP</span>
          <span className="font-bold text-foreground tabular-nums">
            {formatUSD(totals.grossIncome)}
          </span>
        </div>
      )}
    </div>
  )
}
