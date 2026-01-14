/**
 * Create Client Page - Multi-step form for adding new clients
 * Steps: 1. Basic Info → 2. Tax Profile (Intake Questions)
 */

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, User, FileText, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { IntakeQuestionsForm, getDefaultIntakeFormData } from '../../components/clients/intake-questions-form'
import type { IntakeFormData } from '../../components/clients/intake-questions-form'
import { UI_TEXT, LANGUAGE_LABELS } from '../../lib/constants'
import { formatPhone } from '../../lib/formatters'
import { api, type Language } from '../../lib/api-client'

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

interface FormErrors {
  basic?: Partial<Record<keyof BasicInfoData, string>>
  profile?: Partial<Record<keyof IntakeFormData, string>>
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
  const [profileData, setProfileData] = useState<IntakeFormData>(getDefaultIntakeFormData())

  // Step indicators
  const steps = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: User },
    { id: 'profile', label: 'Hồ sơ thuế', icon: FileText },
  ] as const

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  // Phone number validation patterns
  // US format: area code cannot start with 0 or 1, next 3 digits follow same rule
  const US_PHONE_REGEX = /^[2-9]\d{2}[2-9]\d{6}$/

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
    } else if (!US_PHONE_REGEX.test(cleanedPhone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ (mã vùng không được bắt đầu bằng 0 hoặc 1)'
    }

    if (basicInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicInfo.email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    setErrors((prev) => ({ ...prev, basic: newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const validateProfile = (): boolean => {
    const newErrors: Partial<Record<keyof IntakeFormData, string>> = {}

    if (!profileData.taxTypes.length) {
      newErrors.taxTypes = 'Vui lòng chọn ít nhất một loại tờ khai'
    }

    if (!profileData.filingStatus) {
      newErrors.filingStatus = 'Vui lòng chọn tình trạng hôn nhân'
    }

    setErrors((prev) => ({ ...prev, profile: newErrors }))
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

      const response = await api.clients.create({
        name: basicInfo.name.trim(),
        phone: formattedPhone,
        email: basicInfo.email || undefined,
        language: basicInfo.language,
        profile: {
          taxYear: profileData.taxYear,
          taxTypes: profileData.taxTypes,
          filingStatus: profileData.filingStatus,
          hasW2: profileData.hasW2,
          hasBankAccount: profileData.hasBankAccount,
          hasInvestments: profileData.hasInvestments,
          hasKidsUnder17: profileData.hasKidsUnder17,
          numKidsUnder17: profileData.numKidsUnder17,
          paysDaycare: profileData.paysDaycare,
          hasKids17to24: profileData.hasKids17to24,
          hasSelfEmployment: profileData.hasSelfEmployment,
          hasRentalProperty: profileData.hasRentalProperty,
          businessName: profileData.businessName || undefined,
          ein: profileData.ein || undefined,
          hasEmployees: profileData.hasEmployees,
          hasContractors: profileData.hasContractors,
          has1099K: profileData.has1099K,
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
            <IntakeQuestionsForm
              data={profileData}
              onChange={(updates) => setProfileData((prev) => ({ ...prev, ...updates }))}
              errors={errors.profile}
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
