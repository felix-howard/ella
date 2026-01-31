/**
 * Expense Table - Displays Schedule C Part II expense breakdown
 * Only shows expenses with non-zero values
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScheduleCExpense, ScheduleCTotals } from '../../../../lib/api-client'
import { formatUSD, isPositive } from './format-utils'
import { CopyableValue } from './copyable-value'

interface ExpenseTableProps {
  expense: ScheduleCExpense
  totals?: ScheduleCTotals | null
}

// IRS Schedule C expense categories with i18n keys
const EXPENSE_FIELD_KEYS: { key: keyof ScheduleCExpense; i18nKey: string }[] = [
  { key: 'advertising', i18nKey: 'scheduleC.expenseRow.advertising' },
  { key: 'carExpense', i18nKey: 'scheduleC.expenseRow.carExpense' },
  { key: 'commissions', i18nKey: 'scheduleC.expenseRow.commissions' },
  { key: 'contractLabor', i18nKey: 'scheduleC.expenseRow.contractLabor' },
  { key: 'depletion', i18nKey: 'scheduleC.expenseRow.depletion' },
  { key: 'depreciation', i18nKey: 'scheduleC.expenseRow.depreciation' },
  { key: 'employeeBenefits', i18nKey: 'scheduleC.expenseRow.employeeBenefits' },
  { key: 'insurance', i18nKey: 'scheduleC.expenseRow.insurance' },
  { key: 'interestMortgage', i18nKey: 'scheduleC.expenseRow.interestMortgage' },
  { key: 'interestOther', i18nKey: 'scheduleC.expenseRow.interestOther' },
  { key: 'legalServices', i18nKey: 'scheduleC.expenseRow.legalServices' },
  { key: 'officeExpense', i18nKey: 'scheduleC.expenseRow.officeExpense' },
  { key: 'pensionPlans', i18nKey: 'scheduleC.expenseRow.pensionPlans' },
  { key: 'rentEquipment', i18nKey: 'scheduleC.expenseRow.rentEquipment' },
  { key: 'rentProperty', i18nKey: 'scheduleC.expenseRow.rentProperty' },
  { key: 'repairs', i18nKey: 'scheduleC.expenseRow.repairs' },
  { key: 'supplies', i18nKey: 'scheduleC.expenseRow.supplies' },
  { key: 'taxesAndLicenses', i18nKey: 'scheduleC.expenseRow.taxesAndLicenses' },
  { key: 'travel', i18nKey: 'scheduleC.expenseRow.travel' },
  { key: 'meals', i18nKey: 'scheduleC.expenseRow.meals' },
  { key: 'utilities', i18nKey: 'scheduleC.expenseRow.utilities' },
  { key: 'wages', i18nKey: 'scheduleC.expenseRow.wages' },
  { key: 'otherExpenses', i18nKey: 'scheduleC.expenseRow.otherExpenses' },
]

export function ExpenseTable({ expense, totals }: ExpenseTableProps) {
  const { t } = useTranslation()

  // Memoize filtered expense rows to avoid recalculating on every render
  const expenseRows = useMemo(() =>
    EXPENSE_FIELD_KEYS
      .map(field => ({
        label: t(field.i18nKey),
        value: expense[field.key] as string | null,
        key: field.key,
      }))
      .filter(row => isPositive(row.value)),
    [expense, t]
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
            {t('scheduleC.mileageExpense', { miles: expense.vehicleMiles?.toLocaleString() })}
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
              {t('scheduleC.customExpensesDetail')}
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
          {t('scheduleC.notes', { notes: expense.otherExpensesNotes })}
        </div>
      )}

      {/* No expenses message */}
      {expenseRows.length === 0 && !hasMileage && (
        <p className="text-sm text-muted-foreground italic">
          {t('scheduleC.noExpensesYet')}
        </p>
      )}

      {/* Total Expenses */}
      {totals && (
        <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-border">
          <span className="font-medium text-foreground">{t('scheduleC.totalExpenses')}</span>
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
