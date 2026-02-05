/**
 * IncomeSection Component (Simplified)
 * Shows only gross receipts (read-only, auto-calculated from 1099-NECs)
 * CPA-approved: Removed returns, costOfGoods, otherIncome, Line 7 calc
 */
import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { useTranslation } from 'react-i18next'

interface IncomeSectionProps {
  formData: Record<string, unknown>
  prefilledGrossReceipts: string
}

export function IncomeSection({
  formData,
  prefilledGrossReceipts,
}: IncomeSectionProps) {
  const { t } = useTranslation()
  const grossReceipts = Number(formData.grossReceipts) || Number(prefilledGrossReceipts) || 0

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-primary text-lg">
          <DollarSign className="w-5 h-5" />
          {t('expense.income')}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-foreground">
              {t('expense.grossReceipts')}
            </span>
            <span className="text-lg font-semibold text-primary">
              ${grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('expense.autoCalculated')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
