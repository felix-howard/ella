/**
 * Create Client Page - Simplified 2-step form for adding new clients
 * Phase 1: Just name, phone, year → confirm & send SMS
 * Steps: 1. Basic Info → 2. Confirm & Send
 * Supports returning client detection with copy-from-previous feature
 */

import { useState, useCallback } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, User, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { ReturningClientSection, ConfirmStep } from '../../components/clients'
import { UI_TEXT } from '../../lib/constants'
import { formatPhone } from '../../lib/formatters'
import { api, type Language, type ClientWithActions } from '../../lib/api-client'

export const Route = createFileRoute('/clients/new')({
  component: CreateClientPage,
})

// Form steps: basic → confirm
type Step = 'basic' | 'confirm'

interface BasicInfoData {
  name: string
  phone: string
  email: string
  language: Language
  taxYear: number
}

interface FormErrors {
  basic?: Partial<Record<keyof BasicInfoData, string>>
}

// Tax years: previous year (default), then 2 more prior years
// In 2026, we tax for 2025 or before, so options are 2025, 2024, 2023
const currentYear = new Date().getFullYear()
const TAX_YEARS = [currentYear - 1, currentYear - 2, currentYear - 3]

function CreateClientPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  // Returning client detection
  const [existingClient, setExistingClient] = useState<ClientWithActions | null>(null)
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [copyFromEngagementId, setCopyFromEngagementId] = useState<string | null>(null)

  // Form data - simplified: just name, phone, email, language, year
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    name: '',
    phone: '',
    email: '',
    language: 'VI',
    taxYear: currentYear - 1,
  })

  // Check for existing client by phone (debounced)
  const checkExistingClient = useCallback(async (phone: string) => {
    const cleanedPhone = phone.replace(/\D/g, '')
    if (cleanedPhone.length !== 10) {
      setExistingClient(null)
      return
    }

    setIsCheckingPhone(true)
    try {
      const client = await api.clients.searchByPhone(phone)
      setExistingClient(client)
      // If existing client found, pre-fill name from existing
      if (client && !basicInfo.name) {
        setBasicInfo((prev) => ({ ...prev, name: client.name }))
      }
    } catch {
      // Ignore errors - just means no existing client found
      setExistingClient(null)
    } finally {
      setIsCheckingPhone(false)
    }
  }, [basicInfo.name])

  // Handle copy from previous engagement
  const handleCopyFromPrevious = useCallback((engagementId: string | null, shouldCopy: boolean) => {
    setCopyFromEngagementId(shouldCopy ? engagementId : null)
  }, [])

  // Step indicators
  const steps = [
    { id: 'basic', label: t('newClient.stepBasicInfo'), icon: User },
    { id: 'confirm', label: t('newClient.stepConfirm'), icon: Check },
  ] as const

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  // Validation
  const validateBasicInfo = (): boolean => {
    const newErrors: Partial<Record<keyof BasicInfoData, string>> = {}

    if (!basicInfo.name.trim()) {
      newErrors.name = t('newClient.errorNameRequired')
    } else if (basicInfo.name.trim().length < 2) {
      newErrors.name = t('newClient.errorNameMinLength')
    }

    const cleanedPhone = basicInfo.phone.replace(/\D/g, '')
    if (!cleanedPhone) {
      newErrors.phone = t('newClient.errorPhoneRequired')
    } else if (cleanedPhone.length !== 10) {
      newErrors.phone = t('newClient.errorPhoneLength')
    }

    if (basicInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicInfo.email)) {
      newErrors.email = t('newClient.errorEmailInvalid')
    }

    setErrors((prev) => ({ ...prev, basic: newErrors }))
    return Object.keys(newErrors).length === 0
  }

  // Navigation
  const handleNext = () => {
    if (currentStep === 'basic' && validateBasicInfo()) {
      setCurrentStep('confirm')
    }
  }

  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('basic')
    }
  }

  // Submit - create client with minimal data
  const handleSubmit = async () => {
    // Re-validate before submit (defense-in-depth)
    if (!validateBasicInfo()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Sanitize and format phone (remove non-digits, limit to 10 digits)
      const cleanedPhone = basicInfo.phone.replace(/\D/g, '').slice(0, 10)
      const formattedPhone = `+1${cleanedPhone}`

      // Sanitize email (remove control chars, limit length per RFC 5321)
      const sanitizedEmail = basicInfo.email
        ? // eslint-disable-next-line no-control-regex
          basicInfo.email.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 254).trim()
        : undefined

      let clientId: string

      // Handle returning client: create new engagement instead of new client
      if (existingClient) {
        // Create new engagement for existing client (with optional copy from previous)
        await api.engagements.create({
          clientId: existingClient.id,
          taxYear: basicInfo.taxYear,
          copyFromEngagementId: copyFromEngagementId ?? undefined,
        })
        clientId = existingClient.id
      } else {
        // Create new client with minimal profile
        const response = await api.clients.create({
          name: basicInfo.name.trim().slice(0, 100), // Limit name length
          phone: formattedPhone,
          email: sanitizedEmail || undefined,
          language: basicInfo.language,
          profile: {
            taxYear: basicInfo.taxYear,
            taxTypes: ['FORM_1040'], // Default to individual form
          },
        })
        clientId = response.client.id
      }

      // Navigate to client detail
      navigate({ to: '/clients/$clientId', params: { clientId } })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to create client:', error)
      }
      setSubmitError(
        error instanceof Error
          ? error.message
          : t('newClient.errorCreateFailed')
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
        {/* Step 1: Basic Info with Tax Year */}
        {currentStep === 'basic' && (
          <>
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-6">
                <BasicInfoForm
                  data={basicInfo}
                  onChange={(updates) => setBasicInfo((prev) => ({ ...prev, ...updates }))}
                  errors={errors.basic}
                  onPhoneBlur={checkExistingClient}
                  isCheckingPhone={isCheckingPhone}
                />
              </div>

              {/* Returning Client Section */}
              {existingClient && (
                <ReturningClientSection
                  client={existingClient}
                  selectedTaxYear={basicInfo.taxYear}
                  onCopyFromPrevious={handleCopyFromPrevious}
                />
              )}
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
                {t('newClient.continue')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {/* Step 2: Confirm & Send SMS */}
        {currentStep === 'confirm' && (
          <>
            <ConfirmStep
              clientName={basicInfo.name}
              phone={basicInfo.phone}
              taxYear={basicInfo.taxYear}
              language={basicInfo.language}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />

            {/* Error Message */}
            {submitError && (
              <div className="mt-4 p-4 bg-error-light rounded-lg text-error text-sm">
                {submitError}
              </div>
            )}

            {/* Back button */}
            <div className="flex justify-start mt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
                  'border border-border text-foreground hover:bg-muted transition-colors',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                {t('newClient.goBack')}
              </button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  )
}

// Basic Info Form component - simplified with tax year
interface BasicInfoFormProps {
  data: BasicInfoData
  onChange: (data: Partial<BasicInfoData>) => void
  errors?: Partial<Record<keyof BasicInfoData, string>>
  onPhoneBlur?: (phone: string) => void
  isCheckingPhone?: boolean
}

function BasicInfoForm({ data, onChange, errors, onPhoneBlur, isCheckingPhone }: BasicInfoFormProps) {
  const { t } = useTranslation()
  const handlePhoneChange = (value: string) => {
    // Allow only digits and common phone characters
    const cleaned = value.replace(/[^\d\s\-()]/g, '')
    onChange({ phone: cleaned })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-primary mb-4">{t('newClient.basicInfoTitle')}</h2>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="client-name" className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.clientName}
          <span className="text-error ml-1" aria-hidden="true">*</span>
        </label>
        <input
          id="client-name"
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="VD: Nguyễn Văn An"
          aria-required="true"
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? 'name-error' : undefined}
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground',
            errors?.name ? 'border-error' : 'border-border'
          )}
        />
        {errors?.name && <p id="name-error" className="text-sm text-error" role="alert">{errors.name}</p>}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label htmlFor="client-phone" className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.phone}
          <span className="text-error ml-1" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <input
            id="client-phone"
            type="tel"
            value={data.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={() => onPhoneBlur?.(data.phone)}
            placeholder="(818) 222-3333 hoặc 8182223333"
            aria-required="true"
            aria-invalid={!!errors?.phone}
            aria-describedby={errors?.phone ? 'phone-error' : undefined}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'placeholder:text-muted-foreground',
              errors?.phone ? 'border-error' : 'border-border'
            )}
          />
          {isCheckingPhone && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {data.phone && !errors?.phone && (
          <p className="text-xs text-muted-foreground">
            {t('newClient.phoneDisplay')}: {formatPhone(data.phone)}
          </p>
        )}
        {errors?.phone && <p id="phone-error" className="text-sm text-error" role="alert">{errors.phone}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="client-email" className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.email}
          <span className="text-muted-foreground ml-1">({t('newClient.optional')})</span>
        </label>
        <input
          id="client-email"
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="email@example.com"
          aria-invalid={!!errors?.email}
          aria-describedby={errors?.email ? 'email-error' : undefined}
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground',
            errors?.email ? 'border-error' : 'border-border'
          )}
        />
        {errors?.email && <p id="email-error" className="text-sm text-error" role="alert">{errors.email}</p>}
      </div>

      {/* Tax Year */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {t('newClient.taxYear')}
          <span className="text-error ml-1">*</span>
        </label>
        <div className="flex gap-2">
          {TAX_YEARS.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => onChange({ taxYear: year })}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                data.taxYear === year
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
