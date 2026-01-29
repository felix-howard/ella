/**
 * useExpenseForm Hook
 * State management, validation, and submission for expense form
 */
import { useState, useCallback, useMemo } from 'react'
import { expenseApi, type ExpenseFormData } from '../lib/expense-api'
import { EXPENSE_CATEGORIES, VEHICLE_FIELDS, countFilledFields } from '../lib/expense-categories'
import { toApiInput, validateDateRange } from '../lib/form-utils'

export type FormStatus = 'idle' | 'saving' | 'submitting' | 'submitted' | 'error'

export interface UseExpenseFormReturn {
  // Form data
  formData: Record<string, unknown>
  initialData: ExpenseFormData | null
  // Form state
  isDirty: boolean
  status: FormStatus
  errorMessage: string | null
  // Progress
  progress: { filled: number; total: number }
  // Methods
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
    // Empty form with prefilled gross receipts
    return {
      grossReceipts: parseNumber(data?.prefilledGrossReceipts) || null,
      businessName: null,
      businessDesc: null,
    }
  }

  const expense = data.expense
  return {
    businessName: expense.businessName,
    businessDesc: expense.businessDesc,
    // Income - use prefilled if no expense grossReceipts
    grossReceipts: parseNumber(expense.grossReceipts) || parseNumber(data.prefilledGrossReceipts),
    returns: parseNumber(expense.returns),
    costOfGoods: parseNumber(expense.costOfGoods),
    otherIncome: parseNumber(expense.otherIncome),
    // Expenses
    advertising: parseNumber(expense.advertising),
    carExpense: parseNumber(expense.carExpense),
    commissions: parseNumber(expense.commissions),
    contractLabor: parseNumber(expense.contractLabor),
    depletion: parseNumber(expense.depletion),
    depreciation: parseNumber(expense.depreciation),
    employeeBenefits: parseNumber(expense.employeeBenefits),
    insurance: parseNumber(expense.insurance),
    interestMortgage: parseNumber(expense.interestMortgage),
    interestOther: parseNumber(expense.interestOther),
    legalServices: parseNumber(expense.legalServices),
    officeExpense: parseNumber(expense.officeExpense),
    pensionPlans: parseNumber(expense.pensionPlans),
    rentEquipment: parseNumber(expense.rentEquipment),
    rentProperty: parseNumber(expense.rentProperty),
    repairs: parseNumber(expense.repairs),
    supplies: parseNumber(expense.supplies),
    taxesAndLicenses: parseNumber(expense.taxesAndLicenses),
    travel: parseNumber(expense.travel),
    meals: parseNumber(expense.meals),
    utilities: parseNumber(expense.utilities),
    wages: parseNumber(expense.wages),
    otherExpenses: parseNumber(expense.otherExpenses),
    otherExpensesNotes: expense.otherExpensesNotes,
    // Vehicle
    vehicleMiles: expense.vehicleMiles,
    vehicleCommuteMiles: expense.vehicleCommuteMiles,
    vehicleOtherMiles: expense.vehicleOtherMiles,
    vehicleDateInService: expense.vehicleDateInService,
    vehicleUsedForCommute: expense.vehicleUsedForCommute,
    vehicleAnotherAvailable: expense.vehicleAnotherAvailable,
    vehicleEvidenceWritten: expense.vehicleEvidenceWritten,
  }
}

// Validate form data before submission
function validateFormData(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check currency fields for negative values
  const currencyFields = EXPENSE_CATEGORIES.filter(c => c.type === 'currency').map(c => c.field)
  for (const field of currencyFields) {
    const value = data[field]
    if (typeof value === 'number' && value < 0) {
      const category = EXPENSE_CATEGORIES.find(c => c.field === field)
      errors.push(`${category?.label || field}: không được âm`)
    }
  }

  // Check integer fields (vehicle miles)
  const integerFields = VEHICLE_FIELDS.filter(c => c.type === 'integer').map(c => c.field)
  for (const field of integerFields) {
    const value = data[field]
    if (value !== null && value !== undefined) {
      if (typeof value === 'number' && (value < 0 || !Number.isInteger(value))) {
        const category = VEHICLE_FIELDS.find(c => c.field === field)
        errors.push(`${category?.label || field}: phải là số nguyên không âm`)
      }
    }
  }

  // Validate date fields
  const dateStr = data.vehicleDateInService as string | null
  const dateError = validateDateRange(dateStr)
  if (dateError) {
    errors.push(`Ngày bắt đầu sử dụng: ${dateError}`)
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

  // Calculate progress
  const progress = useMemo(() => countFilledFields(formData), [formData])

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
    // Validate before submission
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
    progress,
    updateField,
    updateMultipleFields,
    submit,
    resetError,
  }
}
