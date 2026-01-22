/**
 * Create Client Page - Multi-step form for adding new clients
 * Steps: 1. Basic Info → 2. Tax Selection → 3-6. Intake Wizard (4 steps)
 */

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, User, FileText, ClipboardList } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { WizardContainer, type IntakeAnswers } from '../../components/clients/intake-wizard'
import { CustomSelect } from '../../components/ui/custom-select'
import { UI_TEXT, LANGUAGE_LABELS } from '../../lib/constants'
import { formatPhone } from '../../lib/formatters'
import { api, type Language, type TaxType } from '../../lib/api-client'

export const Route = createFileRoute('/clients/new')({
  component: CreateClientPage,
})

// Form steps: basic → tax-selection → wizard (4 internal steps)
type Step = 'basic' | 'tax-selection' | 'wizard'

interface BasicInfoData {
  name: string
  phone: string
  email: string
  language: Language
}

// Tax info that must be selected before dynamic questions load
interface TaxSelection {
  taxYear: number
  taxTypes: TaxType[]
  filingStatus: string
}

interface FormErrors {
  basic?: Partial<Record<keyof BasicInfoData, string>>
  taxSelection?: Partial<Record<keyof TaxSelection, string>>
}

// Validate wizard answers structure before API submission (defense-in-depth)
function validateWizardAnswers(answers: IntakeAnswers): { valid: boolean; error?: string } {
  // Ensure answers is an object
  if (!answers || typeof answers !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' }
  }

  // Check for too many keys (prevent DoS)
  const keys = Object.keys(answers)
  if (keys.length > 200) {
    return { valid: false, error: 'Quá nhiều trường dữ liệu (tối đa 200)' }
  }

  // Validate dependents array if present
  if (answers.dependents && Array.isArray(answers.dependents)) {
    if (answers.dependents.length > 20) {
      return { valid: false, error: 'Quá nhiều người phụ thuộc (tối đa 20)' }
    }
    for (const dep of answers.dependents) {
      if (!dep || typeof dep !== 'object') {
        return { valid: false, error: 'Thông tin người phụ thuộc không hợp lệ' }
      }
    }
  }

  return { valid: true }
}

// Map wizard answers to legacy profile fields for backward compatibility
// Extracted to utility for maintainability and testability
function mapWizardToLegacyFields(wizardAnswers: IntakeAnswers) {
  return {
    hasW2: wizardAnswers.hasW2 ?? false,
    hasBankAccount: !!wizardAnswers.refundAccountType,
    hasInvestments: wizardAnswers.hasInvestments ?? false,
    hasKidsUnder17: (wizardAnswers.dependentCount ?? 0) > 0,
    numKidsUnder17: wizardAnswers.dependentCount ?? 0,
    paysDaycare: false, // Legacy field - not in wizard
    hasKids17to24: false, // Legacy field - not in wizard
    hasSelfEmployment: wizardAnswers.hasSelfEmployment ?? false,
    hasRentalProperty: wizardAnswers.hasRentalProperty ?? false,
    businessName: undefined, // Handled in intakeAnswers JSON
    ein: undefined, // Handled in intakeAnswers JSON
    hasEmployees: false, // Legacy field - not in wizard
    hasContractors: wizardAnswers.has1099NEC ?? false,
    has1099K: false, // Legacy field - not in wizard
  }
}

function CreateClientPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  // Form data
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    name: '',
    phone: '',
    email: '',
    language: 'VI',
  })

  // Tax selection (shown before wizard)
  const [taxSelection, setTaxSelection] = useState<TaxSelection>({
    taxYear: 2025,
    taxTypes: ['FORM_1040'],
    filingStatus: '',
  })

  // Step indicators (outer steps - wizard has its own internal indicator)
  const steps = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: User },
    { id: 'tax-selection', label: 'Loại thuế', icon: FileText },
    { id: 'wizard', label: 'Câu hỏi chi tiết', icon: ClipboardList },
  ] as const

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  // Validation
  const validateBasicInfo = (): boolean => {
    const newErrors: Partial<Record<keyof BasicInfoData, string>> = {}

    if (!basicInfo.name.trim()) {
      newErrors.name = 'Vui lòng nhập tên khách hàng'
    } else if (basicInfo.name.trim().length < 2) {
      newErrors.name = 'Tên phải có ít nhất 2 ký tự'
    }

    const cleanedPhone = basicInfo.phone.replace(/\D/g, '')
    if (!cleanedPhone) {
      newErrors.phone = 'Vui lòng nhập số điện thoại'
    } else if (cleanedPhone.length !== 10) {
      newErrors.phone = 'Số điện thoại phải có 10 chữ số'
    }

    if (basicInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicInfo.email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    setErrors((prev) => ({ ...prev, basic: newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const validateTaxSelection = (): boolean => {
    const newErrors: Partial<Record<keyof TaxSelection, string>> = {}

    if (!taxSelection.taxTypes.length) {
      newErrors.taxTypes = 'Vui lòng chọn ít nhất một loại tờ khai'
    }

    if (!taxSelection.filingStatus) {
      newErrors.filingStatus = 'Vui lòng chọn tình trạng hôn nhân'
    }

    setErrors((prev) => ({ ...prev, taxSelection: newErrors }))
    return Object.keys(newErrors).length === 0
  }

  // Navigation
  const handleNext = () => {
    if (currentStep === 'basic' && validateBasicInfo()) {
      setCurrentStep('tax-selection')
    } else if (currentStep === 'tax-selection' && validateTaxSelection()) {
      setCurrentStep('wizard')
    }
  }

  const handleBack = () => {
    if (currentStep === 'tax-selection') {
      setCurrentStep('basic')
    } else if (currentStep === 'wizard') {
      setCurrentStep('tax-selection')
    }
  }

  // Submit - called by WizardContainer when wizard completes
  const handleWizardComplete = async (wizardAnswers: IntakeAnswers) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Validate wizard answers structure (defense-in-depth)
      const validation = validateWizardAnswers(wizardAnswers)
      if (!validation.valid) {
        setSubmitError(validation.error || 'Dữ liệu không hợp lệ')
        setIsSubmitting(false)
        return
      }

      // Sanitize and format phone (remove non-digits, limit to 10 digits)
      const cleanedPhone = basicInfo.phone.replace(/\D/g, '').slice(0, 10)
      const formattedPhone = `+1${cleanedPhone}`

      // Sanitize email (remove control chars, limit length per RFC 5321)
      const sanitizedEmail = basicInfo.email
        ? // eslint-disable-next-line no-control-regex
          basicInfo.email.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 254).trim()
        : undefined

      // Combine tax selection with wizard answers
      const allAnswers = {
        ...wizardAnswers,
        taxYear: taxSelection.taxYear,
        filingStatus: taxSelection.filingStatus,
      }

      const response = await api.clients.create({
        name: basicInfo.name.trim().slice(0, 100), // Limit name length
        phone: formattedPhone,
        email: sanitizedEmail || undefined,
        language: basicInfo.language,
        profile: {
          taxYear: taxSelection.taxYear,
          taxTypes: taxSelection.taxTypes,
          filingStatus: taxSelection.filingStatus,
          // Legacy fields for backward compatibility
          ...mapWizardToLegacyFields(wizardAnswers),
          // Full intake answers JSON (includes all wizard data)
          intakeAnswers: allAnswers,
        },
      })

      // Navigate to new client detail
      navigate({ to: '/clients/$clientId', params: { clientId: response.client.id } })
    } catch (error) {
      console.error('Failed to create client:', error)
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Không thể tạo khách hàng. Vui lòng thử lại.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{UI_TEXT.clients.backToList}</span>
        </Link>

        <h1 className="text-2xl font-semibold text-foreground">
          {UI_TEXT.clients.newClient}
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isComplete = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                {/* Step Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                    isComplete
                      ? 'bg-primary text-white'
                      : isActive
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    'ml-2 text-sm font-medium hidden sm:inline',
                    isActive || isComplete ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-16 sm:w-24 h-0.5 mx-4',
                      index < currentStepIndex ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className={cn('mx-auto', currentStep === 'wizard' ? 'max-w-4xl' : 'max-w-2xl')}>
        {/* Step 1: Basic Info */}
        {currentStep === 'basic' && (
          <>
            <div className="bg-card rounded-xl border border-border p-6">
              <BasicInfoForm
                data={basicInfo}
                onChange={(updates) => setBasicInfo((prev) => ({ ...prev, ...updates }))}
                errors={errors.basic}
              />
            </div>
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => navigate({ to: '/clients' })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
                  'border border-border text-foreground hover:bg-muted transition-colors'
                )}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                {UI_TEXT.cancel}
              </button>
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
            </div>
          </>
        )}

        {/* Step 2: Tax Selection */}
        {currentStep === 'tax-selection' && (
          <>
            <div className="bg-card rounded-xl border border-border p-6">
              <TaxSelectionStep
                taxSelection={taxSelection}
                onTaxSelectionChange={(updates) =>
                  setTaxSelection((prev) => ({ ...prev, ...updates }))
                }
                errors={errors.taxSelection}
              />
            </div>
            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={handleBack}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
                  'border border-border text-foreground hover:bg-muted transition-colors'
                )}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Quay lại
              </button>
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
            </div>
          </>
        )}

        {/* Step 3-6: Wizard (4 internal steps) */}
        {currentStep === 'wizard' && (
          <>
            <WizardContainer
              taxTypes={taxSelection.taxTypes}
              filingStatus={taxSelection.filingStatus}
              taxYear={taxSelection.taxYear}
              onComplete={handleWizardComplete}
              onCancel={handleBack}
              isSubmitting={isSubmitting}
            />
            {/* Error Message */}
            {submitError && (
              <div className="mt-4 p-4 bg-error-light rounded-lg text-error text-sm">
                {submitError}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}

// Basic Info Form component
interface BasicInfoFormProps {
  data: BasicInfoData
  onChange: (data: Partial<BasicInfoData>) => void
  errors?: Partial<Record<keyof BasicInfoData, string>>
}

function BasicInfoForm({ data, onChange, errors }: BasicInfoFormProps) {
  const handlePhoneChange = (value: string) => {
    // Allow only digits and common phone characters
    const cleaned = value.replace(/[^\d\s\-()]/g, '')
    onChange({ phone: cleaned })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-primary mb-4">Thông tin cơ bản</h2>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.clientName}
          <span className="text-error ml-1">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="VD: Nguyễn Văn An"
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground',
            errors?.name ? 'border-error' : 'border-border'
          )}
        />
        {errors?.name && <p className="text-sm text-error">{errors.name}</p>}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.phone}
          <span className="text-error ml-1">*</span>
        </label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="(818) 222-3333 hoặc 8182223333"
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground',
            errors?.phone ? 'border-error' : 'border-border'
          )}
        />
        {data.phone && !errors?.phone && (
          <p className="text-xs text-muted-foreground">
            Hiển thị: {formatPhone(data.phone)}
          </p>
        )}
        {errors?.phone && <p className="text-sm text-error">{errors.phone}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.email}
          <span className="text-muted-foreground ml-1">(không bắt buộc)</span>
        </label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="email@example.com"
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground',
            errors?.email ? 'border-error' : 'border-border'
          )}
        />
        {errors?.email && <p className="text-sm text-error">{errors.email}</p>}
      </div>

      {/* Language */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.language}
        </label>
        <div className="flex gap-3">
          {(['VI', 'EN'] as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onChange({ language: lang })}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                data.language === lang
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Tax Selection Step - Simplified step for tax year, types, and filing status
// Filing status options
const FILING_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Độc thân' },
  { value: 'MARRIED_FILING_JOINTLY', label: 'Vợ chồng khai chung' },
  { value: 'MARRIED_FILING_SEPARATELY', label: 'Vợ chồng khai riêng' },
  { value: 'HEAD_OF_HOUSEHOLD', label: 'Chủ hộ' },
  { value: 'QUALIFYING_WIDOW', label: 'Góa phụ có con' },
]

// Tax type options
const TAX_TYPE_OPTIONS: { value: TaxType; label: string; description: string }[] = [
  { value: 'FORM_1040', label: '1040 (Cá nhân)', description: 'Tờ khai thuế cá nhân' },
  { value: 'FORM_1120S', label: '1120S (S-Corp)', description: 'Tờ khai thuế S-Corporation' },
  { value: 'FORM_1065', label: '1065 (Partnership)', description: 'Tờ khai thuế hợp danh' },
]

// Available tax years
const TAX_YEARS = [2025, 2024, 2023]

interface TaxSelectionStepProps {
  taxSelection: TaxSelection
  onTaxSelectionChange: (data: Partial<TaxSelection>) => void
  errors?: Partial<Record<keyof TaxSelection, string>>
}

function TaxSelectionStep({
  taxSelection,
  onTaxSelectionChange,
  errors,
}: TaxSelectionStepProps) {
  const handleTaxTypeToggle = (taxType: TaxType) => {
    const current = taxSelection.taxTypes || []
    const updated = current.includes(taxType)
      ? current.filter((t) => t !== taxType)
      : [...current, taxType]
    onTaxSelectionChange({ taxTypes: updated })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary mb-4">Loại thuế</h2>

      {/* Tax Year */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Năm thuế
          <span className="text-error ml-1">*</span>
        </label>
        <div className="flex gap-2">
          {TAX_YEARS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => onTaxSelectionChange({ taxYear: year })}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                taxSelection.taxYear === year
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Tax Types */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Loại tờ khai
          <span className="text-error ml-1">*</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TAX_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTaxTypeToggle(option.value)}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-colors',
                taxSelection.taxTypes?.includes(option.value)
                  ? 'border-primary bg-primary-light'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <span className="font-medium text-foreground text-sm">{option.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
            </button>
          ))}
        </div>
        {errors?.taxTypes && <p className="text-sm text-error">{errors.taxTypes}</p>}
      </div>

      {/* Filing Status */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Tình trạng hôn nhân
          <span className="text-error ml-1">*</span>
        </label>
        <CustomSelect
          value={taxSelection.filingStatus || ''}
          onChange={(value) => onTaxSelectionChange({ filingStatus: value })}
          options={FILING_STATUS_OPTIONS}
          placeholder="Chọn tình trạng..."
          error={!!errors?.filingStatus}
        />
        {errors?.filingStatus && <p className="text-sm text-error">{errors.filingStatus}</p>}
      </div>

      {/* Info note */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Sau bước này, bạn sẽ trả lời các câu hỏi chi tiết về thu nhập, khấu trừ, và thông tin ngân hàng.
        </p>
      </div>
    </div>
  )
}
