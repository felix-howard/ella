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
    <Card variant="elevated" className="border border-primary/10 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-primary text-lg">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          {t('expense.income')}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="p-4 bg-primary/5 rounded-xl">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium text-foreground">
              {t('expense.grossReceipts')}
            </span>
            <span className="text-xl font-bold text-primary tracking-tight">
              ${grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            {t('expense.autoCalculated')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
