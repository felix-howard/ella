/**
 * WizardContainer - Main orchestrator for 4-step intake wizard
 * Manages step navigation, validation, and form state persistence
 */

import { useState, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { WizardStepIndicator } from './wizard-step-indicator'
import { WizardStep1Identity } from './wizard-step-1-identity'
import { WizardStep2Income } from './wizard-step-2-income'
import { WizardStep3Deductions } from './wizard-step-3-deductions'
import { WizardStep4Review } from './wizard-step-4-review'
import { getSSNValidationError } from '../../../lib/crypto'
import {
  ROUTING_NUMBER_LENGTH,
  MIN_ACCOUNT_NUMBER_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
} from './wizard-constants'
import type { TaxType } from '../../../lib/api-client'

// ABA Routing Number validation (Luhn-like checksum)
function isValidRoutingNumber(routing: string): boolean {
  const digits = routing.replace(/\D/g, '')
  if (digits.length !== ROUTING_NUMBER_LENGTH) return false

  // ABA checksum: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) must be divisible by 10
  const d = digits.split('').map(Number)
  const checksum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
  return checksum % 10 === 0
}

// Bank account number validation (4-17 digits)
function isValidAccountNumber(account: string): boolean {
  const digits = account.replace(/\D/g, '')
  return digits.length >= MIN_ACCOUNT_NUMBER_LENGTH && digits.length <= MAX_ACCOUNT_NUMBER_LENGTH
}

const WIZARD_STEPS = [
  { id: 0, labelKey: 'intakeWizard.steps.identity', shortLabelKey: 'intakeWizard.steps.identityShort' },
  { id: 1, labelKey: 'intakeWizard.steps.income', shortLabelKey: 'intakeWizard.steps.incomeShort' },
  { id: 2, labelKey: 'intakeWizard.steps.deductions', shortLabelKey: 'intakeWizard.steps.deductionsShort' },
  { id: 3, labelKey: 'intakeWizard.steps.review', shortLabelKey: 'intakeWizard.steps.reviewShort' },
] as const

// Dependent data structure
export interface DependentData {
  id: string
  firstName: string
  lastName: string
  ssn: string
  dob: string
  relationship: string
  monthsLivedInHome: number
}

// Full intake answers type
export interface IntakeAnswers {
  // Identity - Taxpayer
  taxpayerSSN?: string
  taxpayerDOB?: string
  taxpayerOccupation?: string
  taxpayerDLNumber?: string
  taxpayerDLIssueDate?: string
  taxpayerDLExpDate?: string
  taxpayerDLState?: string
  taxpayerIPPIN?: string
  // Identity - Spouse (conditional on MFJ)
  spouseSSN?: string
  spouseDOB?: string
  spouseOccupation?: string
  spouseDLNumber?: string
  spouseDLIssueDate?: string
  spouseDLExpDate?: string
  spouseDLState?: string
  spouseIPPIN?: string
  // Dependents
  dependentCount?: number
  dependents?: DependentData[]
  // Bank info
  refundAccountType?: string
  refundBankAccount?: string
  refundRoutingNumber?: string
  // Income flags
  hasW2?: boolean
  w2Count?: number
  has1099NEC?: boolean
  hasSelfEmployment?: boolean
  hasInvestments?: boolean
  hasCrypto?: boolean
  hasRetirement?: boolean
  hasSocialSecurity?: boolean
  hasRentalProperty?: boolean
  rentalPropertyCount?: number
  hasK1Income?: boolean
  k1Count?: number
  // Deduction flags
  hasMortgage?: boolean
  hasMedicalExpenses?: boolean
  hasCharitableDonations?: boolean
  hasStudentLoanInterest?: boolean
  hasEducatorExpenses?: boolean
  hasPropertyTax?: boolean
  // Notes
  followUpNotes?: string
  // All other dynamic fields
  [key: string]: unknown
}

export interface WizardContainerProps {
  initialData?: Partial<IntakeAnswers>
  taxTypes: TaxType[]
  filingStatus: string
  taxYear: number
  onComplete: (data: IntakeAnswers) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export function WizardContainer({
  initialData = {},
  taxTypes,
  filingStatus,
  taxYear,
  onComplete,
  onCancel,
  isSubmitting = false,
}: WizardContainerProps) {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<IntakeAnswers>(() => ({
    dependents: [],
    ...initialData,
  }))
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([0]))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Memoize error clearing callback to prevent unnecessary re-renders
  const clearFieldError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const newErrors = { ...prev }
      delete newErrors[key]
      return newErrors
    })
  }, [])

  // Update answers with field change - optimized to reduce re-renders
  const handleChange = useCallback((key: string, value: unknown) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [key]: value }

      // Clear dependent fields when parent boolean is turned off
      if (value === false) {
        // Income field cascades
        if (key === 'hasW2') delete newAnswers.w2Count
        if (key === 'hasRentalProperty') delete newAnswers.rentalPropertyCount
        if (key === 'hasK1Income') delete newAnswers.k1Count
      }

      return newAnswers
    })

    // Clear error for field when value changes
    clearFieldError(key)
  }, [clearFieldError])

  // Validate current step before proceeding
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      // Identity step validation - SSN is optional but validate format if provided
      if (answers.taxpayerSSN) {
        const ssnError = getSSNValidationError(answers.taxpayerSSN)
        if (ssnError) {
          newErrors.taxpayerSSN = ssnError
        }
      }

      // Spouse SSN validation if MFJ
      if (filingStatus === 'MARRIED_FILING_JOINTLY' && answers.spouseSSN) {
        const ssnError = getSSNValidationError(answers.spouseSSN)
        if (ssnError) {
          newErrors.spouseSSN = ssnError
        }
      }

      // Validate dependents if count > 0
      const depCount = answers.dependentCount || 0
      if (depCount > 0) {
        if (!answers.dependents || answers.dependents.length < depCount) {
          newErrors.dependents = t('intakeWizard.validation.dependentsRequired', { count: depCount })
        } else {
          // Validate each dependent's required fields
          for (let i = 0; i < depCount; i++) {
            const dep = answers.dependents[i]
            if (!dep) continue

            if (!dep.firstName?.trim()) {
              newErrors[`dependent_${i}_firstName`] = t('intakeWizard.validation.dependentMissingFirstName', { index: i + 1 })
            }
            if (!dep.lastName?.trim()) {
              newErrors[`dependent_${i}_lastName`] = t('intakeWizard.validation.dependentMissingLastName', { index: i + 1 })
            }
            if (!dep.ssn) {
              newErrors[`dependent_${i}_ssn`] = t('intakeWizard.validation.dependentMissingSsn', { index: i + 1 })
            } else {
              const ssnError = getSSNValidationError(dep.ssn)
              if (ssnError) {
                newErrors[`dependent_${i}_ssn`] = t('intakeWizard.validation.dependentSsnInvalid', { index: i + 1, error: ssnError })
              }
            }
            if (!dep.dob) {
              newErrors[`dependent_${i}_dob`] = t('intakeWizard.validation.dependentMissingDob', { index: i + 1 })
            }
            if (!dep.relationship) {
              newErrors[`dependent_${i}_relationship`] = t('intakeWizard.validation.dependentMissingRelationship', { index: i + 1 })
            }
          }

          // Consolidate dependent errors into single message
          const depErrors = Object.keys(newErrors).filter(k => k.startsWith('dependent_'))
          if (depErrors.length > 0) {
            newErrors.dependents = t('intakeWizard.validation.dependentErrorCount', { count: depErrors.length })
          }
        }
      }

      // H3 fix: Check for duplicate SSNs across taxpayer, spouse, and dependents
      const allSSNs: { ssn: string; label: string }[] = []
      if (answers.taxpayerSSN) {
        allSSNs.push({ ssn: answers.taxpayerSSN.replace(/\D/g, ''), label: t('intakeWizard.validation.taxpayer') })
      }
      if (filingStatus === 'MARRIED_FILING_JOINTLY' && answers.spouseSSN) {
        allSSNs.push({ ssn: answers.spouseSSN.replace(/\D/g, ''), label: t('intakeWizard.validation.spouse') })
      }
      const dependentTotal = answers.dependentCount || 0
      for (let i = 0; i < dependentTotal; i++) {
        const dep = answers.dependents?.[i]
        if (dep?.ssn) {
          allSSNs.push({ ssn: dep.ssn.replace(/\D/g, ''), label: t('intakeWizard.validation.dependentLabel', { index: i + 1 }) })
        }
      }

      // Find duplicates
      const seen = new Map<string, string>()
      for (const { ssn, label } of allSSNs) {
        if (ssn.length === 9) {
          if (seen.has(ssn)) {
            newErrors.duplicateSSN = t('intakeWizard.validation.duplicateSsn', { label, otherLabel: seen.get(ssn) })
            break
          }
          seen.set(ssn, label)
        }
      }
    }

    if (step === 3) {
      // Review step - bank info required if direct deposit selected
      if (answers.refundAccountType) {
        if (!answers.refundBankAccount) {
          newErrors.refundBankAccount = t('intakeWizard.validation.bankAccountRequired')
        } else if (!isValidAccountNumber(answers.refundBankAccount)) {
          newErrors.refundBankAccount = t('intakeWizard.validation.bankAccountInvalid')
        }

        if (!answers.refundRoutingNumber) {
          newErrors.refundRoutingNumber = t('intakeWizard.validation.routingRequired')
        } else if (!isValidRoutingNumber(answers.refundRoutingNumber)) {
          newErrors.refundRoutingNumber = t('intakeWizard.validation.routingInvalid')
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [answers, filingStatus, t])

  // Navigation handlers
  const handleNext = () => {
    if (!validateStep(currentStep)) return

    if (currentStep < WIZARD_STEPS.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      setVisitedSteps((prev) => new Set([...prev, nextStep]))
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else {
      onCancel()
    }
  }

  const handleStepClick = (step: number) => {
    // Can only go to previously visited steps or validate current before going forward
    if (step < currentStep || visitedSteps.has(step)) {
      setCurrentStep(step)
    } else if (step === currentStep + 1 && validateStep(currentStep)) {
      setCurrentStep(step)
      setVisitedSteps((prev) => new Set([...prev, step]))
    }
  }

  const handleSubmit = () => {
    if (!validateStep(currentStep)) return
    onComplete(answers)
  }

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <WizardStep1Identity
            answers={answers}
            onChange={handleChange}
            filingStatus={filingStatus}
            errors={errors}
          />
        )
      case 1:
        return (
          <WizardStep2Income
            answers={answers}
            onChange={handleChange}
            taxTypes={taxTypes}
            errors={errors}
          />
        )
      case 2:
        return (
          <WizardStep3Deductions
            answers={answers}
            onChange={handleChange}
            errors={errors}
          />
        )
      case 3:
        return (
          <WizardStep4Review
            answers={answers}
            onChange={handleChange}
            filingStatus={filingStatus}
            taxYear={taxYear}
            errors={errors}
          />
        )
      default:
        return null
    }
  }

  const isLastStep = currentStep === WIZARD_STEPS.length - 1

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <WizardStepIndicator
        steps={WIZARD_STEPS.map((step) => ({
          id: step.id,
          label: t(step.labelKey),
          shortLabel: t(step.shortLabelKey),
        }))}
        currentStep={currentStep}
        visitedSteps={visitedSteps}
        onStepClick={handleStepClick}
      />

      {/* Step Content */}
      <div className="bg-card rounded-xl border border-border p-6">
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
            'border border-border text-foreground hover:bg-muted transition-colors'
          )}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {currentStep === 0 ? t('intakeWizard.actions.cancel') : t('intakeWizard.actions.back')}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium',
              'bg-primary text-white hover:bg-primary-dark transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('intakeWizard.actions.creating')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                {t('intakeWizard.actions.finish')}
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium',
              'bg-primary text-white hover:bg-primary-dark transition-colors'
            )}
          >
            {t('intakeWizard.actions.next')}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
