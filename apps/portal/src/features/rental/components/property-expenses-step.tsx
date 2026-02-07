/**
 * PropertyExpensesStep Component
 * Step 3/5/7: Enter property expenses (7 IRS fields + custom list)
 */
import { memo, useCallback, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, HelpCircle, Plus, X } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ScheduleEProperty, ScheduleEOtherExpense } from '@ella/shared'
import { RENTAL_EXPENSE_FIELDS } from '../lib/rental-categories'

interface PropertyExpensesStepProps {
  property: ScheduleEProperty
  onUpdate: (data: Partial<ScheduleEProperty>) => void
  onNext: () => void
  onBack: () => void
  readOnly?: boolean
}

const MAX_OTHER_EXPENSES = 10

export const PropertyExpensesStep = memo(function PropertyExpensesStep({
  property,
  onUpdate,
  onNext,
  onBack,
  readOnly = false,
}: PropertyExpensesStepProps) {
  const { t } = useTranslation()

  // Local state for expense values
  const [expenseValues, setExpenseValues] = useState<Record<string, string>>({
    insurance: String(property.insurance || ''),
    mortgageInterest: String(property.mortgageInterest || ''),
    repairs: String(property.repairs || ''),
    taxes: String(property.taxes || ''),
    utilities: String(property.utilities || ''),
    managementFees: String(property.managementFees || ''),
    cleaningMaintenance: String(property.cleaningMaintenance || ''),
  })

  const [otherExpenses, setOtherExpenses] = useState<ScheduleEOtherExpense[]>(
    property.otherExpenses || []
  )

  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  // Sync with property changes
  useEffect(() => {
    setExpenseValues({
      insurance: String(property.insurance || ''),
      mortgageInterest: String(property.mortgageInterest || ''),
      repairs: String(property.repairs || ''),
      taxes: String(property.taxes || ''),
      utilities: String(property.utilities || ''),
      managementFees: String(property.managementFees || ''),
      cleaningMaintenance: String(property.cleaningMaintenance || ''),
    })
    setOtherExpenses(property.otherExpenses || [])
  }, [property])

  // Handle expense field change
  // Regex allows: empty, digits only, or digits with decimal point followed by up to 2 digits
  const handleExpenseChange = useCallback((field: string, value: string) => {
    if (value === '' || /^\d+$/.test(value) || /^\d+\.\d{0,2}$/.test(value) || /^\d*\.$/.test(value)) {
      setExpenseValues((prev) => ({ ...prev, [field]: value }))
      const num = parseFloat(value)
      if (!isNaN(num) && num >= 0) {
        onUpdate({ [field]: num } as Partial<ScheduleEProperty>)
      } else if (value === '' || value === '.') {
        onUpdate({ [field]: 0 } as Partial<ScheduleEProperty>)
      }
    }
  }, [onUpdate])

  // Format on blur
  const handleBlur = useCallback((field: string) => {
    setExpenseValues((prev) => {
      const val = prev[field]
      if (val !== '' && !isNaN(parseFloat(val))) {
        return { ...prev, [field]: parseFloat(val).toFixed(2) }
      }
      return prev
    })
  }, [])

  // Handle other expense changes
  const handleOtherExpenseNameChange = useCallback((index: number, name: string) => {
    setOtherExpenses((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], name }
      onUpdate({ otherExpenses: updated })
      return updated
    })
  }, [onUpdate])

  const handleOtherExpenseAmountChange = useCallback((index: number, value: string) => {
    // Same validation: empty, digits only, or digits with decimal up to 2 places
    if (value === '' || /^\d+$/.test(value) || /^\d+\.\d{0,2}$/.test(value) || /^\d*\.$/.test(value)) {
      setOtherExpenses((prev) => {
        const updated = [...prev]
        const num = parseFloat(value)
        updated[index] = { ...updated[index], amount: isNaN(num) ? 0 : num }
        onUpdate({ otherExpenses: updated })
        return updated
      })
    }
  }, [onUpdate])

  const handleAddOtherExpense = useCallback(() => {
    if (otherExpenses.length >= MAX_OTHER_EXPENSES) return
    setOtherExpenses((prev) => {
      const updated = [...prev, { name: '', amount: 0 }]
      onUpdate({ otherExpenses: updated })
      return updated
    })
  }, [otherExpenses.length, onUpdate])

  const handleRemoveOtherExpense = useCallback((index: number) => {
    setOtherExpenses((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      onUpdate({ otherExpenses: updated })
      return updated
    })
  }, [onUpdate])

  // Calculate totals
  const standardExpensesTotal = Object.values(expenseValues).reduce((sum, val) => {
    const num = parseFloat(val)
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  const otherExpensesTotal = otherExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const totalExpenses = standardExpensesTotal + otherExpensesTotal

  return (
    <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t('rental.propertyExpenses', { id: property.id })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('rental.propertyExpensesDescription')}
        </p>
      </div>

      {/* Expense fields */}
      <div className="space-y-4 mb-6">
        {RENTAL_EXPENSE_FIELDS.map((field) => (
          <div key={field.field}>
            {/* Label with tooltip */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <label
                htmlFor={`expense-${field.field}`}
                className="text-sm font-medium text-foreground"
              >
                {field.label}
              </label>
              <button
                type="button"
                onClick={() => setShowTooltip(showTooltip === field.field ? null : field.field)}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={t('rental.showTooltip')}
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Tooltip */}
              {showTooltip === field.field && (
                <div
                  role="tooltip"
                  className="absolute left-6 right-6 mt-8 z-[60] p-3 bg-foreground text-background text-xs rounded-lg shadow-lg"
                >
                  {field.tooltip}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                id={`expense-${field.field}`}
                type="text"
                inputMode="decimal"
                value={expenseValues[field.field] || ''}
                onChange={(e) => handleExpenseChange(field.field, e.target.value)}
                onBlur={() => handleBlur(field.field)}
                disabled={readOnly}
                placeholder={field.placeholder}
                className={cn(
                  'w-full h-10 pl-7 pr-3 bg-card border border-border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Other expenses */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('rental.otherExpenses')}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {t('rental.otherExpensesDescription')}
        </p>

        {/* Other expense rows */}
        <div className="space-y-3">
          {otherExpenses.map((expense, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={expense.name}
                onChange={(e) => handleOtherExpenseNameChange(index, e.target.value)}
                disabled={readOnly}
                placeholder={t('rental.expenseName')}
                className={cn(
                  'flex-1 h-10 px-3 bg-card border border-border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={expense.amount || ''}
                  onChange={(e) => handleOtherExpenseAmountChange(index, e.target.value)}
                  disabled={readOnly}
                  placeholder="0.00"
                  className={cn(
                    'w-full h-10 pl-7 pr-3 bg-card border border-border rounded-lg text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveOtherExpense(index)}
                  className="p-2 text-muted-foreground hover:text-error transition-colors"
                  aria-label={t('rental.deleteExpense')}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add button */}
        {!readOnly && otherExpenses.length < MAX_OTHER_EXPENSES && (
          <button
            type="button"
            onClick={handleAddOtherExpense}
            className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('rental.addExpense')}
          </button>
        )}
      </div>

      {/* Running total */}
      <div className="bg-muted/50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">
            {t('rental.totalExpenses')}
          </span>
          <span className="text-lg font-semibold text-foreground">
            ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="mt-auto pt-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('rental.back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={readOnly}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          {t('rental.next')}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
})

PropertyExpensesStep.displayName = 'PropertyExpensesStep'
