/**
 * Income Table - Displays Schedule C Part I income breakdown
 * Shows per-payer 1099-NEC breakdown when available
 */
import type { ScheduleCExpense, ScheduleCTotals, NecBreakdownItem } from '../../../../lib/api-client'
import { formatUSD } from './format-utils'
import { CopyableValue } from './copyable-value'
import { NecBreakdownList } from './nec-breakdown-list'

interface IncomeTableProps {
  expense: ScheduleCExpense
  totals?: ScheduleCTotals | null
  showGrossIncome?: boolean
  necBreakdown?: NecBreakdownItem[]
}

export function IncomeTable({ expense, totals, showGrossIncome = false, necBreakdown = [] }: IncomeTableProps) {
  // Dynamic label: show count if breakdown available
  const grossReceiptsLabel = necBreakdown.length > 0
    ? `Tổng thu (từ ${necBreakdown.length} mẫu 1099-NEC)`
    : 'Tổng thu (từ 1099-NEC)'

  const rows = [
    { label: grossReceiptsLabel, value: expense.grossReceipts, isGross: true },
    { label: 'Trả hàng và giảm giá', value: expense.returns, isGross: false },
    { label: 'Giá vốn hàng bán', value: expense.costOfGoods, isGross: false },
    { label: 'Thu nhập khác', value: expense.otherIncome, isGross: false },
  ]

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        // Skip if value is null/0 (except grossReceipts which should always show)
        const numValue = parseFloat(row.value || '0')
        if (!row.isGross && numValue === 0) return null

        return (
          <div key={row.label}>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <CopyableValue
                formatted={formatUSD(row.value)}
                rawValue={row.value}
                className="font-medium text-foreground"
              />
            </div>
            {/* Show per-payer breakdown under gross receipts when >1 payer */}
            {row.isGross && necBreakdown.length > 1 && (
              <div className="mt-1.5">
                <NecBreakdownList items={necBreakdown} />
              </div>
            )}
          </div>
        )
      })}

      {/* Gross Income Total (if requested) */}
      {showGrossIncome && totals && (
        <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-border">
          <span className="font-medium text-foreground">THU NHẬP GỘP</span>
          <CopyableValue
            formatted={formatUSD(totals.grossIncome)}
            rawValue={totals.grossIncome}
            className="font-bold text-foreground"
          />
        </div>
      )}
    </div>
  )
}
