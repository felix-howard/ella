/**
 * ExpenseForm Component
 * Main container for Schedule C expense form
 * Includes income section, expense sections, car section, vehicle info
 */
import { useState, useCallback } from 'react'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import type { ExpenseFormData } from '../lib/expense-api'
import { EXPENSE_GROUPS } from '../lib/expense-categories'
import { useExpenseForm } from '../hooks/use-expense-form'
import { useAutoSave } from '../hooks/use-auto-save'
import { IncomeSection } from './income-section'
import { ExpenseSection } from './expense-section'
import { CarExpenseSection } from './car-expense-section'
import { VehicleInfoSection } from './vehicle-info-section'
import { ProgressIndicator } from './progress-indicator'
import { AutoSaveIndicator } from './auto-save-indicator'
import { SuccessMessage } from './success-message'

interface ExpenseFormProps {
  token: string
  initialData: ExpenseFormData
}

export function ExpenseForm({ token, initialData }: ExpenseFormProps) {
  const [showSuccess, setShowSuccess] = useState(false)
  const [submittedVersion, setSubmittedVersion] = useState(1)

  // Form state management
  const {
    formData,
    isDirty,
    status,
    errorMessage,
    progress,
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

  // Handle submit - directly submit without modal
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
  const buttonText = isFirstSubmit ? 'Gửi cho CPA' : 'Cập nhật'

  return (
    <div className="pb-32">
      {/* Form sections */}
      <div className="space-y-4 px-4">
        {/* Progress indicator */}
        <ProgressIndicator
          filled={progress.filled}
          total={progress.total}
          className="py-2"
        />

        {/* Locked warning */}
        {isLocked && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-error">Form đã bị khóa</p>
              <p className="text-sm text-muted-foreground mt-1">
                CPA đã khóa form này. Vui lòng liên hệ văn phòng nếu cần chỉnh sửa.
              </p>
            </div>
          </div>
        )}

        {/* Income section */}
        <IncomeSection
          formData={formData}
          prefilledGrossReceipts={initialData.prefilledGrossReceipts}
          onChange={handleFieldChange}
        />

        {/* Expense sections - grouped */}
        {EXPENSE_GROUPS.filter(g => g !== 'car').map((group) => (
          <ExpenseSection
            key={group}
            group={group}
            formData={formData}
            onChange={handleFieldChange}
          />
        ))}

        {/* Car expense section (special handling) */}
        <CarExpenseSection
          formData={formData}
          onChange={handleFieldChange}
        />

        {/* Vehicle info section (conditional) */}
        <VehicleInfoSection
          formData={formData}
          onChange={handleFieldChange}
        />

        {/* Other expenses notes */}
        <div className="px-1">
          <label
            htmlFor="otherExpensesNotes"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Ghi chú chi phí khác (tùy chọn)
          </label>
          <textarea
            id="otherExpensesNotes"
            value={(formData.otherExpensesNotes as string) || ''}
            onChange={(e) => handleFieldChange('otherExpensesNotes', e.target.value || null)}
            placeholder="Mô tả chi tiết các chi phí khác nếu có..."
            disabled={isLocked}
            rows={3}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

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
            className="w-full h-12 text-base font-medium gap-2"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {buttonText}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
