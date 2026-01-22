/**
 * WizardContainer - Main orchestrator for 4-step intake wizard
 * Manages step navigation, validation, and form state persistence
 */

import { useState, useCallback, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
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

// Wizard step labels in Vietnamese
const WIZARD_STEPS = [
  { id: 0, label: 'Thông tin cá nhân', shortLabel: 'Cá nhân' },
  { id: 1, label: 'Thu nhập', shortLabel: 'Thu nhập' },
  { id: 2, label: 'Khấu trừ', shortLabel: 'Khấu trừ' },
  { id: 3, label: 'Xem lại & Gửi', shortLabel: 'Xem lại' },
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
          newErrors.dependents = `Vui lòng nhập thông tin cho ${depCount} người phụ thuộc`
        } else {
          // Validate each dependent's required fields
          for (let i = 0; i < depCount; i++) {
            const dep = answers.dependents[i]
            if (!dep) continue

            if (!dep.firstName?.trim()) {
              newErrors[`dependent_${i}_firstName`] = `Người phụ thuộc #${i + 1}: Thiếu tên`
            }
            if (!dep.lastName?.trim()) {
              newErrors[`dependent_${i}_lastName`] = `Người phụ thuộc #${i + 1}: Thiếu họ`
            }
            if (!dep.ssn) {
              newErrors[`dependent_${i}_ssn`] = `Người phụ thuộc #${i + 1}: Thiếu SSN`
            } else {
              const ssnError = getSSNValidationError(dep.ssn)
              if (ssnError) {
                newErrors[`dependent_${i}_ssn`] = `Người phụ thuộc #${i + 1}: ${ssnError}`
              }
            }
            if (!dep.dob) {
              newErrors[`dependent_${i}_dob`] = `Người phụ thuộc #${i + 1}: Thiếu ngày sinh`
            }
            if (!dep.relationship) {
              newErrors[`dependent_${i}_relationship`] = `Người phụ thuộc #${i + 1}: Thiếu quan hệ`
            }
          }

          // Consolidate dependent errors into single message
          const depErrors = Object.keys(newErrors).filter(k => k.startsWith('dependent_'))
          if (depErrors.length > 0) {
            newErrors.dependents = `Có ${depErrors.length} lỗi trong thông tin người phụ thuộc`
          }
        }
      }
    }

    if (step === 3) {
      // Review step - bank info required if direct deposit selected
      if (answers.refundAccountType) {
        if (!answers.refundBankAccount) {
          newErrors.refundBankAccount = 'Vui lòng nhập số tài khoản'
        } else if (!isValidAccountNumber(answers.refundBankAccount)) {
          newErrors.refundBankAccount = 'Số tài khoản phải có 4-17 chữ số'
        }

        if (!answers.refundRoutingNumber) {
          newErrors.refundRoutingNumber = 'Vui lòng nhập routing number'
        } else if (!isValidRoutingNumber(answers.refundRoutingNumber)) {
          newErrors.refundRoutingNumber = 'Routing number không hợp lệ (9 chữ số, checksum sai)'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [answers, filingStatus])

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
        steps={WIZARD_STEPS}
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
          {currentStep === 0 ? 'Hủy' : 'Quay lại'}
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
                Đang tạo...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Hoàn tất
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
            Tiếp tục
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
