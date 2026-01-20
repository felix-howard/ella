/**
 * Create Client Page - Multi-step form for adding new clients
 * Steps: 1. Basic Info → 2. Tax Profile (Intake Questions)
 */

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, User, FileText, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { MultiSectionIntakeForm } from '../../components/clients/multi-section-intake-form'
import { CustomSelect } from '../../components/ui/custom-select'
import { UI_TEXT, LANGUAGE_LABELS } from '../../lib/constants'
import { formatPhone } from '../../lib/formatters'
import { api, type Language, type TaxType } from '../../lib/api-client'

export const Route = createFileRoute('/clients/new')({
  component: CreateClientPage,
})

// Form steps
type Step = 'basic' | 'profile'

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

  // Tax selection (shown at top of profile step)
  const [taxSelection, setTaxSelection] = useState<TaxSelection>({
    taxYear: 2025,
    taxTypes: ['FORM_1040'],
    filingStatus: '',
  })

  // Dynamic intake answers from MultiSectionIntakeForm
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, unknown>>({})

  // Step indicators
  const steps = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: User },
    { id: 'profile', label: 'Hồ sơ thuế', icon: FileText },
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

  const validateProfile = (): boolean => {
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
      setCurrentStep('profile')
    }
  }

  const handleBack = () => {
    if (currentStep === 'profile') {
      setCurrentStep('basic')
    }
  }

  // Submit
  const handleSubmit = async () => {
    if (!validateProfile()) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Format phone as +1XXXXXXXXXX for US numbers (backend requirement)
      const cleanedPhone = basicInfo.phone.replace(/\D/g, '')
      const formattedPhone = `+1${cleanedPhone}`

      // Combine tax selection with dynamic intake answers
      const allAnswers = {
        ...intakeAnswers,
        taxYear: taxSelection.taxYear,
        filingStatus: taxSelection.filingStatus,
      }

      const response = await api.clients.create({
        name: basicInfo.name.trim(),
        phone: formattedPhone,
        email: basicInfo.email || undefined,
        language: basicInfo.language,
        profile: {
          taxYear: taxSelection.taxYear,
          taxTypes: taxSelection.taxTypes,
          filingStatus: taxSelection.filingStatus,
          // Legacy fields for backward compatibility (also saved in intakeAnswers)
          hasW2: (intakeAnswers.hasW2 as boolean) ?? false,
          hasBankAccount: (intakeAnswers.hasBankAccount as boolean) ?? false,
          hasInvestments: (intakeAnswers.hasInvestments as boolean) ?? false,
          hasKidsUnder17: (intakeAnswers.hasKidsUnder17 as boolean) ?? false,
          numKidsUnder17: (intakeAnswers.numKidsUnder17 as number) ?? 0,
          paysDaycare: (intakeAnswers.paysDaycare as boolean) ?? false,
          hasKids17to24: (intakeAnswers.hasKids17to24 as boolean) ?? false,
          hasSelfEmployment: (intakeAnswers.hasSelfEmployment as boolean) ?? false,
          hasRentalProperty: (intakeAnswers.hasRentalProperty as boolean) ?? false,
          businessName: (intakeAnswers.businessName as string) || undefined,
          ein: (intakeAnswers.ein as string) || undefined,
          hasEmployees: (intakeAnswers.hasEmployees as boolean) ?? false,
          hasContractors: (intakeAnswers.hasContractors as boolean) ?? false,
          has1099K: (intakeAnswers.has1099K as boolean) ?? false,
          // NEW: Full intake answers JSON
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-xl border border-border p-6">
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <BasicInfoForm
              data={basicInfo}
              onChange={(updates) => setBasicInfo((prev) => ({ ...prev, ...updates }))}
              errors={errors.basic}
            />
          )}

          {/* Step 2: Profile/Intake Questions */}
          {currentStep === 'profile' && (
            <ProfileStep
              taxSelection={taxSelection}
              onTaxSelectionChange={(updates) =>
                setTaxSelection((prev) => ({ ...prev, ...updates }))
              }
              intakeAnswers={intakeAnswers}
              onIntakeAnswersChange={setIntakeAnswers}
              errors={errors.taxSelection}
            />
          )}

          {/* Error Message */}
          {submitError && (
            <div className="mt-4 p-4 bg-error-light rounded-lg text-error text-sm">
              {submitError}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={currentStep === 'basic' ? () => navigate({ to: '/clients' }) : handleBack}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
              'border border-border text-foreground hover:bg-muted transition-colors'
            )}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {currentStep === 'basic' ? UI_TEXT.cancel : 'Quay lại'}
          </button>

          {currentStep === 'basic' ? (
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
          ) : (
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
                  Tạo khách hàng
                </>
              )}
            </button>
          )}
        </div>
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

// Profile Step - Tax selection + Dynamic intake form
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

interface ProfileStepProps {
  taxSelection: TaxSelection
  onTaxSelectionChange: (data: Partial<TaxSelection>) => void
  intakeAnswers: Record<string, unknown>
  onIntakeAnswersChange: (answers: Record<string, unknown>) => void
  errors?: Partial<Record<keyof TaxSelection, string>>
}

function ProfileStep({
  taxSelection,
  onTaxSelectionChange,
  intakeAnswers,
  onIntakeAnswersChange,
  errors,
}: ProfileStepProps) {
  const handleTaxTypeToggle = (taxType: TaxType) => {
    const current = taxSelection.taxTypes || []
    const updated = current.includes(taxType)
      ? current.filter((t) => t !== taxType)
      : [...current, taxType]
    onTaxSelectionChange({ taxTypes: updated })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary mb-4">Hồ sơ thuế</h2>

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

      {/* Divider */}
      <div className="border-t border-border my-6" />

      {/* Dynamic Intake Questions */}
      <div className="space-y-2">
        <h3 className="text-base font-medium text-foreground">Câu hỏi chi tiết</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Trả lời các câu hỏi sau để chúng tôi có thể tạo danh sách tài liệu cần thiết
        </p>
        <MultiSectionIntakeForm
          taxTypes={taxSelection.taxTypes}
          answers={intakeAnswers}
          onChange={onIntakeAnswersChange}
        />
      </div>
    </div>
  )
}
