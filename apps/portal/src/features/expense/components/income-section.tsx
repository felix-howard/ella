/**
 * IncomeSection Component
 * Displays income fields (Part I of Schedule C)
 * Gross receipts is prefilled from 1099-NECs and read-only
 */
import { useMemo } from 'react'
import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { ExpenseField } from './expense-field'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../lib/expense-categories'

interface IncomeSectionProps {
  formData: Record<string, unknown>
  prefilledGrossReceipts: string
  onChange: (field: string, value: unknown) => void
}

export function IncomeSection({
  formData,
  prefilledGrossReceipts,
  onChange,
}: IncomeSectionProps) {
  // Get income categories
  const incomeCategories = useMemo(
    () => EXPENSE_CATEGORIES.filter(cat => cat.group === 'income'),
    []
  )

  // Calculate totals
  const grossReceipts = Number(formData.grossReceipts) || Number(prefilledGrossReceipts) || 0
  const returns = Number(formData.returns) || 0
  const costOfGoods = Number(formData.costOfGoods) || 0
  const otherIncome = Number(formData.otherIncome) || 0
  const grossIncome = grossReceipts - returns - costOfGoods + otherIncome

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-primary text-lg">
          <DollarSign className="w-5 h-5" />
          Thu nhập (Part I)
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Gross Receipts - Read Only */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-foreground">
              Thu nhập gộp (1099-NEC)
            </span>
            <span className="text-lg font-semibold text-primary">
              ${grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Tự động tính từ các form 1099-NEC đã nhận
          </p>
        </div>

        {/* Other income fields */}
        <div className="grid gap-4">
          {incomeCategories
            .filter(cat => cat.field !== 'grossReceipts')
            .map((category: ExpenseCategory) => (
              <ExpenseField
                key={category.field}
                category={category}
                value={formData[category.field] as number | null}
                onChange={(value) => onChange(category.field, value)}
              />
            ))}
        </div>

        {/* Gross Income Summary */}
        <div className="pt-4 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">
              Thu nhập ròng (Line 7)
            </span>
            <span className={`text-lg font-bold ${grossIncome >= 0 ? 'text-success' : 'text-error'}`}>
              ${grossIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            = Thu nhập gộp - Hoàn trả - Giá vốn + Thu nhập khác
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
