/**
 * Expense Table - Displays Schedule C Part II expense breakdown
 * Only shows expenses with non-zero values
 */
import { useMemo } from 'react'
import type { ScheduleCExpense, ScheduleCTotals } from '../../../../lib/api-client'
import { formatUSD, isPositive } from './format-utils'
import { CopyableValue } from './copyable-value'

interface ExpenseTableProps {
  expense: ScheduleCExpense
  totals?: ScheduleCTotals | null
}

// IRS Schedule C expense categories with Vietnamese labels
const EXPENSE_FIELDS: { key: keyof ScheduleCExpense; label: string }[] = [
  { key: 'advertising', label: 'Quảng cáo' },
  { key: 'carExpense', label: 'Chi phí xe (thực tế)' },
  { key: 'commissions', label: 'Hoa hồng và phí' },
  { key: 'contractLabor', label: 'Thuê ngoài' },
  { key: 'depletion', label: 'Khấu hao tài nguyên' },
  { key: 'depreciation', label: 'Khấu hao tài sản' },
  { key: 'employeeBenefits', label: 'Phúc lợi nhân viên' },
  { key: 'insurance', label: 'Bảo hiểm (trừ y tế)' },
  { key: 'interestMortgage', label: 'Lãi vay thế chấp' },
  { key: 'interestOther', label: 'Lãi vay khác' },
  { key: 'legalServices', label: 'Dịch vụ pháp lý & chuyên môn' },
  { key: 'officeExpense', label: 'Chi phí văn phòng' },
  { key: 'pensionPlans', label: 'Kế hoạch hưu trí' },
  { key: 'rentEquipment', label: 'Thuê máy móc/thiết bị' },
  { key: 'rentProperty', label: 'Thuê mặt bằng' },
  { key: 'repairs', label: 'Sửa chữa & bảo trì' },
  { key: 'supplies', label: 'Vật tư' },
  { key: 'taxesAndLicenses', label: 'Thuế & giấy phép' },
  { key: 'travel', label: 'Đi lại' },
  { key: 'meals', label: 'Ăn uống (50%)' },
  { key: 'utilities', label: 'Tiện ích' },
  { key: 'wages', label: 'Lương nhân viên' },
  { key: 'otherExpenses', label: 'Chi phí khác' },
]

export function ExpenseTable({ expense, totals }: ExpenseTableProps) {
  // Memoize filtered expense rows to avoid recalculating on every render
  const expenseRows = useMemo(() =>
    EXPENSE_FIELDS
      .map(field => ({
        label: field.label,
        value: expense[field.key] as string | null,
        key: field.key,
      }))
      .filter(row => isPositive(row.value)),
    [expense]
  )

  // Custom expenses from new simplified form (JSONB array)
  const hasCustomExpenses = expense.customExpenses && Array.isArray(expense.customExpenses) && expense.customExpenses.length > 0

  // Calculate mileage if vehicleMiles is set
  const hasMileage = expense.vehicleMiles && expense.vehicleMiles > 0
  const mileageDeduction = totals?.mileageDeduction

  return (
    <div className="space-y-2">
      {/* Mileage deduction (if using standard mileage method) */}
      {hasMileage && isPositive(mileageDeduction) && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            Chi phí xe ({expense.vehicleMiles?.toLocaleString()} dặm × $0.67)
          </span>
          <CopyableValue
            formatted={formatUSD(mileageDeduction)}
            rawValue={mileageDeduction}
            className="font-medium text-foreground w-28 justify-end flex-shrink-0"
          />
        </div>
      )}

      {/* Expense rows */}
      {expenseRows.map((row) => (
        <div key={row.key} className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <CopyableValue
            formatted={formatUSD(row.value)}
            rawValue={row.value}
            className="font-medium text-foreground w-28 justify-end flex-shrink-0"
          />
        </div>
      ))}

      {/* Custom expenses (dynamic "Other" list from new simplified form) */}
      {hasCustomExpenses && (
        <>
          <div className="pt-2 mt-2 border-t border-border/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Chi phí khác (chi tiết)
            </span>
          </div>
          {(expense.customExpenses as Array<{ name: string; amount: number }>).map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm pl-3">
              <span className="text-muted-foreground">{item.name}</span>
              <CopyableValue
                formatted={formatUSD(item.amount.toFixed(2))}
                rawValue={item.amount.toFixed(2)}
                className="font-medium text-foreground w-28 justify-end flex-shrink-0"
              />
            </div>
          ))}
        </>
      )}

      {/* Other expenses notes (legacy — hidden when customExpenses present) */}
      {expense.otherExpensesNotes && isPositive(expense.otherExpenses) && !hasCustomExpenses && (
        <div className="text-xs text-muted-foreground pl-4 italic">
          Ghi chú: {expense.otherExpensesNotes}
        </div>
      )}

      {/* No expenses message */}
      {expenseRows.length === 0 && !hasMileage && (
        <p className="text-sm text-muted-foreground italic">
          Chưa có chi phí nào được khai báo
        </p>
      )}

      {/* Total Expenses */}
      {totals && (
        <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-border">
          <span className="font-medium text-foreground">TỔNG CHI PHÍ</span>
          <CopyableValue
            formatted={formatUSD(totals.totalExpenses)}
            rawValue={totals.totalExpenses}
            className="font-bold text-foreground w-28 justify-end flex-shrink-0"
          />
        </div>
      )}
    </div>
  )
}
