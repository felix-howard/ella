/**
 * useRentalForm Hook
 * State management for multi-step rental property wizard
 * Handles property count, wizard navigation, validation, and submission
 */
import { useState, useCallback, useMemo, useRef } from 'react'
import type {
  ScheduleEProperty,
  ScheduleEPropertyId,
  ScheduleEPropertyType,
} from '@ella/shared'
import { createEmptyProperty } from '@ella/shared'
import { rentalApi } from '../lib/rental-api'
import type { RentalFormData } from '../lib/rental-api'

export type FormStatus = 'idle' | 'saving' | 'submitting' | 'submitted' | 'error'

export interface UseRentalFormReturn {
  // Wizard state
  currentStep: number
  totalSteps: number
  goNext: () => void
  goBack: () => void
  goToStep: (step: number) => void

  // Property data
  propertyCount: 1 | 2 | 3
  setPropertyCount: (count: 1 | 2 | 3) => void
  properties: ScheduleEProperty[]
  updateProperty: (index: number, data: Partial<ScheduleEProperty>) => void

  // Form state
  isDirty: boolean
  status: FormStatus
  errorMessage: string | null
  isLocked: boolean
  version: number

  // Actions
  submit: () => Promise<boolean>
  resetError: () => void
  resetForEdit: () => void

  // Helpers
  getCurrentPropertyIndex: () => number | null
  isDetailsStep: (step: number) => boolean
  isExpensesStep: (step: number) => boolean
  getPropertyForStep: (step: number) => ScheduleEProperty | null
}

// Property IDs in order
const PROPERTY_IDS: ScheduleEPropertyId[] = ['A', 'B', 'C']

// Calculate step layout
// Step 0: Property count selection
// Steps 1,2: Property A (details, expenses)
// Steps 3,4: Property B (details, expenses) - if propertyCount >= 2
// Steps 5,6: Property C (details, expenses) - if propertyCount >= 3
// Last step: Review

function calculateTotalSteps(propertyCount: 1 | 2 | 3): number {
  // 1 (count) + propertyCount * 2 (details + expenses) + 1 (review)
  return 1 + propertyCount * 2 + 1
}

export function useRentalForm(
  token: string,
  initialData: RentalFormData
): UseRentalFormReturn {
  const { expense } = initialData

  // Initialize property count from existing data or default to 1
  const initialPropertyCount = useMemo(() => {
    if (expense?.properties?.length) {
      return Math.min(3, Math.max(1, expense.properties.length)) as 1 | 2 | 3
    }
    return 1
  }, [expense])

  // Initialize properties from existing data or create empty ones
  const initialProperties = useMemo(() => {
    if (expense?.properties?.length) {
      // Ensure we have the right IDs
      return expense.properties.map((p, i) => ({
        ...p,
        id: PROPERTY_IDS[i] || p.id,
      }))
    }
    return [createEmptyProperty('A')]
  }, [expense])

  // State
  const [currentStep, setCurrentStep] = useState(0)
  const [propertyCount, setPropertyCountState] = useState<1 | 2 | 3>(initialPropertyCount)
  const [properties, setProperties] = useState<ScheduleEProperty[]>(initialProperties)
  const [isDirty, setIsDirty] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Refs for tracking
  const propertiesRef = useRef(properties)
  propertiesRef.current = properties

  // Derived state
  const totalSteps = calculateTotalSteps(propertyCount)
  const isLocked = expense?.status === 'LOCKED'
  const version = expense?.version ?? 0

  // Set property count and adjust properties array
  const setPropertyCount = useCallback((count: 1 | 2 | 3) => {
    setPropertyCountState(count)
    setProperties((prev) => {
      const newProperties = [...prev]
      // Add missing properties
      while (newProperties.length < count) {
        const id = PROPERTY_IDS[newProperties.length]
        newProperties.push(createEmptyProperty(id))
      }
      // Remove excess properties (keep only up to count)
      return newProperties.slice(0, count)
    })
    setIsDirty(true)
  }, [])

  // Update a single property
  const updateProperty = useCallback((index: number, data: Partial<ScheduleEProperty>) => {
    setProperties((prev) => {
      const newProperties = [...prev]
      if (newProperties[index]) {
        newProperties[index] = { ...newProperties[index], ...data }

        // Auto-calculate fairRentalDays from monthsRented
        if ('monthsRented' in data && data.monthsRented !== undefined) {
          newProperties[index].fairRentalDays = data.monthsRented * 30
        }

        // Auto-calculate totals
        const p = newProperties[index]
        const totalExpenses =
          (p.insurance || 0) +
          (p.mortgageInterest || 0) +
          (p.repairs || 0) +
          (p.taxes || 0) +
          (p.utilities || 0) +
          (p.managementFees || 0) +
          (p.cleaningMaintenance || 0) +
          (p.otherExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0)

        newProperties[index].totalExpenses = totalExpenses
        newProperties[index].netIncome = (p.rentsReceived || 0) - totalExpenses
      }
      return newProperties
    })
    setIsDirty(true)
  }, [])

  // Navigation helpers
  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1))
  }, [totalSteps])

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }, [])

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step)
    }
  }, [totalSteps])

  // Step type helpers
  const isDetailsStep = useCallback((step: number): boolean => {
    if (step === 0 || step === totalSteps - 1) return false
    return (step - 1) % 2 === 0
  }, [totalSteps])

  const isExpensesStep = useCallback((step: number): boolean => {
    if (step === 0 || step === totalSteps - 1) return false
    return (step - 1) % 2 === 1
  }, [totalSteps])

  // Get property index for current step
  const getCurrentPropertyIndex = useCallback((): number | null => {
    if (currentStep === 0 || currentStep === totalSteps - 1) return null
    return Math.floor((currentStep - 1) / 2)
  }, [currentStep, totalSteps])

  // Get property for a given step
  const getPropertyForStep = useCallback((step: number): ScheduleEProperty | null => {
    if (step === 0 || step === totalSteps - 1) return null
    const index = Math.floor((step - 1) / 2)
    return properties[index] || null
  }, [properties, totalSteps])

  // Submit form
  const submit = useCallback(async (): Promise<boolean> => {
    if (isLocked) {
      setErrorMessage('Form đã bị khóa. Không thể chỉnh sửa.')
      return false
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      await rentalApi.submit(token, { properties: propertiesRef.current })
      setStatus('submitted')
      setIsDirty(false)
      return true
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Không thể gửi form. Vui lòng thử lại.')
      return false
    }
  }, [token, isLocked])

  // Reset error
  const resetError = useCallback(() => {
    setErrorMessage(null)
    if (status === 'error') {
      setStatus('idle')
    }
  }, [status])

  // Reset for editing after submission
  const resetForEdit = useCallback(() => {
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  return {
    // Wizard state
    currentStep,
    totalSteps,
    goNext,
    goBack,
    goToStep,

    // Property data
    propertyCount,
    setPropertyCount,
    properties,
    updateProperty,

    // Form state
    isDirty,
    status,
    errorMessage,
    isLocked,
    version,

    // Actions
    submit,
    resetError,
    resetForEdit,

    // Helpers
    getCurrentPropertyIndex,
    isDetailsStep,
    isExpensesStep,
    getPropertyForStep,
  }
}
