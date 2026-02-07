/**
 * RentalForm Component
 * Main multi-step wizard form for Schedule E rental properties
 */
import { memo, useCallback, useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '../../../lib/toast-store'
import type { RentalFormData } from '../lib/rental-api'
import { useRentalForm } from '../hooks/use-rental-form'
import { useRentalAutoSave } from '../hooks/use-rental-auto-save'
import { PropertyCountStep } from './property-count-step'
import { PropertyDetailsStep } from './property-details-step'
import { PropertyExpensesStep } from './property-expenses-step'
import { ReviewStep } from './review-step'
import { RentalSuccessMessage } from './rental-success-message'
import { RentalProgressIndicator } from './rental-progress-indicator'
import { RentalAutoSaveIndicator } from './rental-auto-save-indicator'

interface RentalFormProps {
  token: string
  initialData: RentalFormData
}

export const RentalForm = memo(function RentalForm({
  token,
  initialData,
}: RentalFormProps) {
  const { t } = useTranslation()

  // Form state
  const {
    currentStep,
    totalSteps,
    goNext,
    goBack,
    goToStep,
    propertyCount,
    setPropertyCount,
    properties,
    updateProperty,
    isDirty,
    status,
    errorMessage,
    isLocked,
    version,
    initialPropertyCount,
    submit,
    resetError,
    resetForEdit,
    getCurrentPropertyIndex,
    isDetailsStep,
    isExpensesStep,
    getPropertyForStep,
  } = useRentalForm(token, initialData)

  // Auto-save
  const autoSave = useRentalAutoSave(token, properties, isDirty, status)

  // Local state for showing success after submission
  const [showSuccess, setShowSuccess] = useState(false)

  // Show toast when error occurs
  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage, 6000)
      resetError()
    }
  }, [errorMessage, resetError])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const success = await submit()
    if (success) {
      setShowSuccess(true)
    }
  }, [submit])

  // Handle edit again after success
  const handleEditAgain = useCallback(() => {
    setShowSuccess(false)
    resetForEdit()
    goToStep(0)
  }, [goToStep, resetForEdit])

  // Handle property edit from review
  const handleEditProperty = useCallback((propertyIndex: number) => {
    // Navigate to details step for this property
    // Step 0 = count, Steps 1,2 = property 0, Steps 3,4 = property 1, etc.
    const detailsStep = 1 + propertyIndex * 2
    goToStep(detailsStep)
  }, [goToStep])

  // Get current property for details/expenses steps
  const currentPropertyIndex = getCurrentPropertyIndex()
  const currentProperty = currentPropertyIndex !== null ? properties[currentPropertyIndex] : null

  // Update current property
  const handleUpdateProperty = useCallback((data: any) => {
    if (currentPropertyIndex !== null) {
      updateProperty(currentPropertyIndex, data)
    }
  }, [currentPropertyIndex, updateProperty])

  // Show success message if submitted
  if (showSuccess || status === 'submitted') {
    return (
      <RentalSuccessMessage
        version={version + 1}
        onEditAgain={handleEditAgain}
      />
    )
  }

  // Render current step
  const renderStep = () => {
    // Step 0: Property count selection
    if (currentStep === 0) {
      return (
        <PropertyCountStep
          value={propertyCount}
          onChange={setPropertyCount}
          onNext={goNext}
          readOnly={isLocked}
          initialPropertyCount={initialPropertyCount}
        />
      )
    }

    // Last step: Review
    if (currentStep === totalSteps - 1) {
      return (
        <ReviewStep
          properties={properties}
          onEditProperty={handleEditProperty}
          onBack={goBack}
          onSubmit={handleSubmit}
          isSubmitting={status === 'submitting'}
          isLocked={isLocked}
        />
      )
    }

    // Details or expenses steps
    if (currentProperty) {
      if (isDetailsStep(currentStep)) {
        return (
          <PropertyDetailsStep
            property={currentProperty}
            onUpdate={handleUpdateProperty}
            onNext={goNext}
            onBack={goBack}
            readOnly={isLocked}
          />
        )
      }

      if (isExpensesStep(currentStep)) {
        return (
          <PropertyExpensesStep
            property={currentProperty}
            onUpdate={handleUpdateProperty}
            onNext={goNext}
            onBack={goBack}
            readOnly={isLocked}
          />
        )
      }
    }

    return null
  }

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Locked banner */}
      {isLocked && (
        <div className="bg-warning/10 border-b border-warning/30 px-6 py-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-warning" />
          <span className="text-sm text-warning">{t('rental.formLocked')}</span>
        </div>
      )}

      {/* Progress indicator */}
      <RentalProgressIndicator
        currentStep={currentStep}
        totalSteps={totalSteps}
      />

      {/* Step content */}
      {renderStep()}

      {/* Auto-save indicator (fixed at bottom when not on review step) */}
      {currentStep !== totalSteps - 1 && !isLocked && (
        <div className="sticky bottom-0 px-6 py-3 bg-background/80 backdrop-blur-sm border-t border-border">
          <RentalAutoSaveIndicator
            status={autoSave.status}
            lastSaved={autoSave.lastSaved}
            error={autoSave.error}
          />
        </div>
      )}
    </div>
  )
})

RentalForm.displayName = 'RentalForm'
