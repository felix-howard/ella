/**
 * CarExpenseSection Component
 * Toggle between mileage rate deduction OR actual car expenses
 * IRS allows only one method, not both
 */
import { useMemo, useCallback } from 'react'
import { Car, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { cn } from '@ella/ui'
import { ExpenseField } from './expense-field'
import { EXPENSE_CATEGORIES, MILEAGE_RATE_2025 } from '../lib/expense-categories'

type DeductionMethod = 'mileage' | 'actual'

interface CarExpenseSectionProps {
  formData: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
}

export function CarExpenseSection({
  formData,
  onChange,
}: CarExpenseSectionProps) {
  // Determine current method based on which field has a value
  const currentMethod: DeductionMethod | null = useMemo(() => {
    const hasCarExpense = formData.carExpense !== null && formData.carExpense !== undefined && formData.carExpense !== 0
    const hasMileage = formData.vehicleMiles !== null && formData.vehicleMiles !== undefined && formData.vehicleMiles !== 0

    if (hasCarExpense && !hasMileage) return 'actual'
    if (hasMileage && !hasCarExpense) return 'mileage'
    if (hasCarExpense || hasMileage) return hasMileage ? 'mileage' : 'actual'
    return null
  }, [formData.carExpense, formData.vehicleMiles])

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden="true">🚗</span>
          Chi phí xe & Mileage
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          IRS cho phép dùng 1 trong 2 phương pháp (không được dùng cả 2)
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
              'p-4 rounded-lg border-2 text-left transition-all',
              currentMethod === 'mileage' || currentMethod === null
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Mileage Rate</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ${MILEAGE_RATE_2025}/dặm × số dặm kinh doanh
            </p>
            {currentMethod === 'mileage' && (
              <div className="mt-2 pt-2 border-t border-primary/20">
                <span className="text-sm font-semibold text-primary">
                  Khuyên dùng
                </span>
              </div>
            )}
          </button>

          {/* Actual Expenses Option */}
          <button
            type="button"
            onClick={() => handleMethodChange('actual')}
            className={cn(
              'p-4 rounded-lg border-2 text-left transition-all',
              currentMethod === 'actual'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Car className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Chi phí thực tế</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Xăng, bảo hiểm, sửa chữa, đậu xe...
            </p>
          </button>
        </div>

        {/* Mileage fields */}
        {(currentMethod === 'mileage' || currentMethod === null) && (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-muted rounded-lg">
              <label
                htmlFor="expense-vehicleMiles"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Số dặm kinh doanh trong năm
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
                  placeholder="VD: 12,000"
                  className="w-full h-10 px-3 pr-12 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  dặm
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Chỉ tính số dặm cho công việc (giao hàng, gặp khách...), không tính đi làm
              </p>
            </div>

            {/* Mileage calculation result */}
            {businessMiles > 0 && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Khấu trừ mileage:</span>
                  <span className="text-lg font-semibold text-primary">
                    ${mileageDeduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {businessMiles.toLocaleString()} dặm × ${MILEAGE_RATE_2025}/dặm
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actual expense field */}
        {currentMethod === 'actual' && carExpenseCategory && (
          <div className="pt-2">
            <ExpenseField
              category={carExpenseCategory}
              value={formData.carExpense as number | null}
              onChange={(value) => onChange('carExpense', value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Bao gồm: xăng, bảo hiểm xe, sửa chữa, rửa xe, đậu xe, phí cầu đường
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
