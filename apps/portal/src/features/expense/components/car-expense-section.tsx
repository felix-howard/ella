/**
 * CarExpenseSection Component
 * Toggle between mileage rate deduction OR actual car expenses
 * IRS allows only one method, not both
 */
import { useState, useMemo, useCallback } from 'react'
import { Car, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import { ExpenseField } from './expense-field'
import { EXPENSE_CATEGORIES, MILEAGE_RATE_2025 } from '../lib/expense-categories'

type DeductionMethod = 'mileage' | 'actual'

interface CarExpenseSectionProps {
  formData: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
}

// Derive initial method from form data values
function deriveMethodFromData(formData: Record<string, unknown>): DeductionMethod {
  const hasCarExpense = formData.carExpense !== null && formData.carExpense !== undefined && formData.carExpense !== 0
  const hasMileage = formData.vehicleMiles !== null && formData.vehicleMiles !== undefined && formData.vehicleMiles !== 0
  if (hasCarExpense && !hasMileage) return 'actual'
  // Default to mileage
  return 'mileage'
}

export function CarExpenseSection({
  formData,
  onChange,
}: CarExpenseSectionProps) {
  const { t } = useTranslation()
  // Track selected method explicitly (default: derived from data, fallback mileage)
  const [selectedMethod, setSelectedMethod] = useState<DeductionMethod>(() =>
    deriveMethodFromData(formData)
  )

  // Get car expense category
  const carExpenseCategory = useMemo(
    () => EXPENSE_CATEGORIES.find(cat => cat.field === 'carExpense'),
    []
  )

  // Calculate mileage deduction
  const businessMiles = Number(formData.vehicleMiles) || 0
  const mileageDeduction = businessMiles * MILEAGE_RATE_2025

  // Handle method change
  const handleMethodChange = useCallback((method: DeductionMethod) => {
    setSelectedMethod(method)
    if (method === 'mileage') {
      // Clear actual expense when switching to mileage
      onChange('carExpense', null)
    } else {
      // Clear mileage when switching to actual
      onChange('vehicleMiles', null)
      onChange('vehicleCommuteMiles', null)
      onChange('vehicleOtherMiles', null)
    }
  }, [onChange])

  return (
    <Card variant="elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Car className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          {t('expense.carAndMileage')}
        </CardTitle>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('expense.carMethodNote')}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Method selection */}
        <div className="grid grid-cols-2 gap-3">
          {/* Mileage Rate Option */}
          <button
            type="button"
            onClick={() => handleMethodChange('mileage')}
            className={cn(
              'p-4 rounded-xl text-left transition-all duration-200 cursor-pointer',
              selectedMethod === 'mileage'
                ? 'bg-primary/5 shadow-md ring-2 ring-primary/20'
                : 'bg-card shadow-sm hover:shadow-md border border-border/40'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                selectedMethod === 'mileage' ? 'bg-primary/15' : 'bg-muted'
              )}>
                <Calculator className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">{t('expense.mileageRate')}</span>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {t('expense.mileageRateDescription', { rate: MILEAGE_RATE_2025 })}
            </p>
            {selectedMethod === 'mileage' && (
              <div className="mt-2.5 pt-2 border-t border-primary/10">
                <span className="text-xs font-semibold text-primary">
                  {t('expense.mileageRecommended')}
                </span>
              </div>
            )}
          </button>

          {/* Actual Expenses Option */}
          <button
            type="button"
            onClick={() => handleMethodChange('actual')}
            className={cn(
              'p-4 rounded-xl text-left transition-all duration-200 cursor-pointer',
              selectedMethod === 'actual'
                ? 'bg-primary/5 shadow-md ring-2 ring-primary/20'
                : 'bg-card shadow-sm hover:shadow-md border border-border/40'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                selectedMethod === 'actual' ? 'bg-primary/15' : 'bg-muted'
              )}>
                <Car className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">{t('expense.actualExpense')}</span>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {t('expense.actualExpenseDescription')}
            </p>
          </button>
        </div>

        {/* Mileage fields */}
        {selectedMethod === 'mileage' && (
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/50 rounded-xl">
              <label
                htmlFor="expense-vehicleMiles"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t('expense.businessMiles')}
              </label>
              <div className="relative">
                <input
                  id="expense-vehicleMiles"
                  type="text"
                  inputMode="numeric"
                  value={formData.vehicleMiles !== null && formData.vehicleMiles !== undefined ? String(formData.vehicleMiles) : ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      onChange('vehicleMiles', null)
                      return
                    }
                    if (/^\d*$/.test(raw)) {
                      const num = parseInt(raw, 10)
                      if (!isNaN(num)) {
                        onChange('vehicleMiles', num)
                      }
                    }
                  }}
                  placeholder={t('expense.businessMilesPlaceholder')}
                  className="w-full h-11 px-3.5 pr-14 bg-card border border-border/60 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md transition-all duration-200 placeholder:text-muted-foreground/50"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium">
                  {t('expense.miles')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-2">
                {t('expense.businessMilesNote')}
              </p>
            </div>

            {/* Mileage calculation result */}
            {businessMiles > 0 && (
              <div className="p-4 bg-primary/5 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">{t('expense.mileageDeduction')}</span>
                  <span className="text-xl font-bold text-primary tracking-tight">
                    ${mileageDeduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  {t('expense.mileageCalculation', { miles: businessMiles.toLocaleString(), rate: MILEAGE_RATE_2025 })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actual expense field */}
        {selectedMethod === 'actual' && carExpenseCategory && (
          <div className="pt-2">
            <ExpenseField
              category={carExpenseCategory}
              value={formData.carExpense as number | null}
              onChange={(value) => onChange('carExpense', value)}
            />
            <p className="text-xs text-muted-foreground/70 mt-2">
              {t('expense.actualCarIncludes')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
