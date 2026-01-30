/**
 * useExpenseForm Hook (Simplified)
 * State management, validation, and submission for simplified expense form
 * CPA-approved: 5 fields + customExpenses dynamic list
 */
import { useState, useCallback } from 'react'
import { expenseApi, type ExpenseFormData } from '../lib/expense-api'
import { toApiInput } from '../lib/form-utils'

export type FormStatus = 'idle' | 'saving' | 'submitting' | 'submitted' | 'error'

export interface UseExpenseFormReturn {
  formData: Record<string, unknown>
  initialData: ExpenseFormData | null
  isDirty: boolean
  status: FormStatus
  errorMessage: string | null
  updateField: (field: string, value: unknown) => void
  updateMultipleFields: (fields: Record<string, unknown>) => void
  submit: () => Promise<boolean>
  resetError: () => void
}

// Convert string number to actual number or null
function parseNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

// Initialize form data from API response
function initializeFormData(data: ExpenseFormData | null): Record<string, unknown> {
  if (!data?.expense) {
    // Empty form: prefilled gross receipts + default Equipment example row
    return {
      grossReceipts: parseNumber(data?.prefilledGrossReceipts) || null,
      travel: null,
      meals: null,
      supplies: null,
      vehicleMiles: null,
      carExpense: null,
      customExpenses: [{ name: 'Equipment', amount: null }],
    }
  }

  const expense = data.expense

  // Parse existing customExpenses or create default example row
  let customExpenses: Array<{ name: string; amount: number | null }> = [{ name: 'Equipment', amount: null }]
  if (expense.customExpenses && Array.isArray(expense.customExpenses) && expense.customExpenses.length > 0) {
    customExpenses = expense.customExpenses
  }

  return {
    grossReceipts: parseNumber(expense.grossReceipts) || parseNumber(data.prefilledGrossReceipts),
    travel: parseNumber(expense.travel),
    meals: parseNumber(expense.meals),
    supplies: parseNumber(expense.supplies),
    vehicleMiles: expense.vehicleMiles,
    carExpense: parseNumber(expense.carExpense),
    customExpenses,
  }
}

// Validate form data before submission
function validateFormData(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate currency fields are not negative
  for (const field of ['travel', 'meals', 'supplies', 'carExpense']) {
    const value = data[field]
    if (typeof value === 'number' && value < 0) {
      errors.push(`${field}: không được âm`)
    }
  }

  // Validate customExpenses: require both name+amount or neither
  const items = data.customExpenses as Array<{ name: string; amount: number | null }> | undefined
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.name && (item.amount === null || item.amount === undefined)) {
        errors.push(`Chi phí khác "${item.name}": cần nhập số tiền`)
      }
      if (item.amount !== null && item.amount !== undefined && !item.name) {
        errors.push(`Chi phí khác dòng ${i + 1}: cần nhập tên chi phí`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function useExpenseForm(
  token: string,
  initialData: ExpenseFormData | null
): UseExpenseFormReturn {
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    initializeFormData(initialData)
  )
  const [isDirty, setIsDirty] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Update single field
  const updateField = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  // Update multiple fields at once
  const updateMultipleFields = useCallback((fields: Record<string, unknown>) => {
    setFormData(prev => ({ ...prev, ...fields }))
    setIsDirty(true)
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  // Reset error state
  const resetError = useCallback(() => {
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  // Submit form
  const submit = useCallback(async (): Promise<boolean> => {
    const { valid, errors } = validateFormData(formData)
    if (!valid) {
      setErrorMessage(errors.join('. '))
      setStatus('error')
      return false
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      const input = toApiInput(formData)
      await expenseApi.submit(token, input)
      setStatus('submitted')
      setIsDirty(false)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi form. Vui lòng thử lại.'
      setErrorMessage(message)
      setStatus('error')
      return false
    }
  }, [token, formData])

  return {
    formData,
    initialData,
    isDirty,
    status,
    errorMessage,
    updateField,
    updateMultipleFields,
    submit,
    resetError,
  }
}
