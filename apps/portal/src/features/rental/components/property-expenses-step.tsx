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

  // Track raw string values for other expense amounts to preserve intermediate input like "123."
  const [otherAmountStrings, setOtherAmountStrings] = useState<string[]>(
    () => (property.otherExpenses || []).map((e) => e.amount ? String(e.amount) : '')
  )

  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  // Sync with property changes - only update if numeric value actually changed
  // This prevents losing intermediate input like "300." when parent re-renders
  useEffect(() => {
    setExpenseValues((prev) => {
      const fields = ['insurance', 'mortgageInterest', 'repairs', 'taxes', 'utilities', 'managementFees', 'cleaningMaintenance'] as const
      const updated = { ...prev }
      for (const field of fields) {
        const propValue = property[field] || 0
        const localValue = parseFloat(prev[field]) || 0
        // Only update if the numeric values differ (preserves intermediate input like "300.")
        if (propValue !== localValue) {
          updated[field] = propValue ? String(propValue) : ''
        }
      }
      return updated
    })
    setOtherExpenses(property.otherExpenses || [])
    // Only update otherAmountStrings if numeric values differ (preserves "300." while typing)
    setOtherAmountStrings((prev) => {
      const propExpenses = property.otherExpenses || []
      // If lengths differ, need full sync
      if (prev.length !== propExpenses.length) {
        return propExpenses.map((e) => e.amount ? String(e.amount) : '')
      }
      // Otherwise, only update entries where numeric value changed
      return prev.map((localStr, i) => {
        const propValue = propExpenses[i]?.amount || 0
        const localValue = parseFloat(localStr) || 0
        return propValue !== localValue ? (propValue ? String(propValue) : '') : localStr
      })
    })
  }, [property])

  // Handle expense field change
  // Regex allows: empty, or any valid decimal number with up to 2 decimal places
  const handleExpenseChange = useCallback((field: string, value: string) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
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
    // Same validation: empty, or any valid decimal number with up to 2 decimal places
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      // Update raw string state to preserve intermediate values like "123."
      setOtherAmountStrings((prev) => {
        const updated = [...prev]
        updated[index] = value
        return updated
      })
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
    setOtherAmountStrings((prev) => [...prev, ''])
    setOtherExpenses((prev) => {
      const updated = [...prev, { name: '', amount: 0 }]
      onUpdate({ otherExpenses: updated })
      return updated
    })
  }, [otherExpenses.length, onUpdate])

  const handleRemoveOtherExpense = useCallback((index: number) => {
    setOtherAmountStrings((prev) => prev.filter((_, i) => i !== index))
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

  // Shared input classes
  const inputClasses = cn(
    'w-full h-11 bg-card rounded-xl text-sm shadow-sm',
    'border border-border/60',
    'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition-all duration-200',
    'placeholder:text-muted-foreground/50'
  )

  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          {t('rental.propertyExpenses', { id: property.id })}
        </h2>
        <p className="text-sm text-muted-foreground/80">
          {t('rental.propertyExpensesDescription')}
        </p>
      </div>

      {/* Expense fields */}
      <div className="space-y-5 mb-6">
        {RENTAL_EXPENSE_FIELDS.map((field) => (
          <div key={field.field} className="relative">
            {/* Label with tooltip */}
            <div className="flex items-center gap-1.5 mb-2">
              <label
                htmlFor={`expense-${field.field}`}
                className="text-sm font-medium text-foreground"
              >
                {field.label}
              </label>
              <button
                type="button"
                onClick={() => setShowTooltip(showTooltip === field.field ? null : field.field)}
                className="text-muted-foreground/60 hover:text-primary transition-colors"
                aria-label={t('rental.showTooltip')}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              {/* Tooltip */}
              {showTooltip === field.field && (
                <div
                  role="tooltip"
                  className="absolute left-0 right-0 mt-8 z-[60] p-3 bg-foreground text-background text-xs rounded-xl shadow-lg"
                >
                  {field.tooltip}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-sm font-medium">$</span>
              <input
                id={`expense-${field.field}`}
                type="text"
                inputMode="decimal"
                value={expenseValues[field.field] || ''}
                onChange={(e) => handleExpenseChange(field.field, e.target.value)}
                onBlur={() => handleBlur(field.field)}
                disabled={readOnly}
                placeholder={field.placeholder}
                className={cn(inputClasses, 'pl-8 pr-3.5')}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Other expenses */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">{t('rental.otherExpenses')}</h3>
        <p className="text-xs text-muted-foreground/70 mb-3">
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
                className={cn(inputClasses, 'flex-1 px-3.5')}
              />
              <div className="relative w-28">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-sm font-medium">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={otherAmountStrings[index] ?? ''}
                  onChange={(e) => handleOtherExpenseAmountChange(index, e.target.value)}
                  disabled={readOnly}
                  placeholder="0.00"
                  className={cn(inputClasses, 'pl-8 pr-3.5')}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveOtherExpense(index)}
                  className="p-2 text-muted-foreground/50 hover:text-error transition-colors duration-200 cursor-pointer"
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
            className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('rental.addExpense')}
          </button>
        )}
      </div>

      {/* Running total */}
      <div className="bg-card shadow-sm rounded-xl p-4 mb-6 border border-border/30">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">
            {t('rental.totalExpenses')}
          </span>
          <span className="text-xl font-bold text-foreground tracking-tight">
            ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="mt-auto pt-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 gap-2 h-12 rounded-xl"
          size="lg"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('rental.back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={readOnly}
          className="flex-1 gap-2 h-12 rounded-xl shadow-md"
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
