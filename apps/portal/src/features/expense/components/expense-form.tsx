/**
 * ExpenseForm Component (Simplified)
 * Main container for Schedule C expense form
 * CPA-approved: 5 fields + dynamic "Other" list instead of 28 IRS fields
 */
import { useState, useCallback } from 'react'
import { Loader2, Send, AlertCircle, Receipt } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ExpenseFormData } from '../lib/expense-api'
import { SIMPLIFIED_EXPENSE_FIELDS } from '../lib/expense-categories'
import { useExpenseForm } from '../hooks/use-expense-form'
import { useAutoSave } from '../hooks/use-auto-save'
import { IncomeSection } from './income-section'
import { ExpenseField } from './expense-field'
import { CarExpenseSection } from './car-expense-section'
import { OtherExpenseList, type CustomExpenseItem } from './other-expense-list'
import { AutoSaveIndicator } from './auto-save-indicator'
import { SuccessMessage } from './success-message'

interface ExpenseFormProps {
  token: string
  initialData: ExpenseFormData
}

export function ExpenseForm({ token, initialData }: ExpenseFormProps) {
  const { t } = useTranslation()
  const [showSuccess, setShowSuccess] = useState(false)
  const [submittedVersion, setSubmittedVersion] = useState(1)

  // Form state management
  const {
    formData,
    isDirty,
    status,
    errorMessage,
    updateField,
    submit,
    resetError,
  } = useExpenseForm(token, initialData)

  // Auto-save
  const autoSave = useAutoSave(token, formData, isDirty, status)

  // Check if form is locked
  const isLocked = initialData.expense?.status === 'LOCKED'

  // Handle field change
  const handleFieldChange = useCallback((field: string, value: unknown) => {
    if (isLocked) return
    updateField(field, value)
  }, [isLocked, updateField])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (isLocked) return
    const success = await submit()
    if (success) {
      setSubmittedVersion((initialData.expense?.version || 0) + 1)
      setShowSuccess(true)
    }
  }, [isLocked, submit, initialData.expense?.version])

  // Handle edit after success
  const handleEdit = useCallback(() => {
    setShowSuccess(false)
    resetError()
  }, [resetError])

  // Show success screen
  if (showSuccess) {
    return <SuccessMessage version={submittedVersion} onEdit={handleEdit} />
  }

  // Determine button text
  const isFirstSubmit = !initialData.expense || initialData.expense.status === 'DRAFT'
  const buttonText = isFirstSubmit ? t('expense.submitToCPA') : t('expense.update')

  return (
    <div className="pb-32">
      {/* Form sections */}
      <div className="space-y-4 px-4">
        {/* Locked warning */}
        {isLocked && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-error">{t('expense.formLocked')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('expense.formLockedMessage')}
              </p>
            </div>
          </div>
        )}

        {/* Income section (read-only gross receipts) */}
        <IncomeSection
          formData={formData}
          prefilledGrossReceipts={initialData.prefilledGrossReceipts}
        />

        {/* Simplified expense fields (travel, meals, supplies) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="w-5 h-5 text-primary" />
              {t('expense.businessExpenses')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {SIMPLIFIED_EXPENSE_FIELDS.map((category) => (
              <ExpenseField
                key={category.field}
                category={category}
                value={formData[category.field] as number | null}
                onChange={(value) => handleFieldChange(category.field, value)}
              />
            ))}
          </CardContent>
        </Card>

        {/* Car expense section (mileage/actual toggle — IRS-required) */}
        <CarExpenseSection
          formData={formData}
          onChange={handleFieldChange}
        />

        {/* Other expenses (dynamic add/delete list) */}
        <OtherExpenseList
          items={(formData.customExpenses as CustomExpenseItem[]) || []}
          onChange={(items) => handleFieldChange('customExpenses', items)}
          disabled={isLocked}
        />

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-sm text-error">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Sticky submit button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          {/* Auto-save indicator */}
          <div className="mb-2 flex justify-center">
            <AutoSaveIndicator
              status={autoSave.status}
              lastSaved={autoSave.lastSaved}
              error={autoSave.error}
            />
          </div>

          {/* Submit button */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLocked || status === 'submitting'}
            className="w-full h-12 text-base font-medium"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('expense.submitting')}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>{buttonText}</span>
                </>
              )}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
