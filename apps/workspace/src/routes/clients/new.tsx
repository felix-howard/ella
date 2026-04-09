/**
 * Create Client Page - Multi-path wizard for adding new clients
 * Paths: Individual | Individual + Business | Business Only
 * Steps vary by path: type-select -> form(s) -> confirm & send
 */

import { useState, useCallback } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, User, Building2, Check, Send, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import {
  ReturningClientSection,
  ConfirmStep,
  DEFAULT_SMS_TEMPLATE_VI,
  DEFAULT_SMS_TEMPLATE_EN,
  ClientTypeSelector,
  BusinessInfoForm,
  BasicInfoForm,
  EMPTY_BUSINESS_INFO,
  type ClientCreationType,
  type BusinessInfoData,
  type BasicInfoData,
} from '../../components/clients'
import { UI_TEXT } from '../../lib/constants'
import { api, type ClientWithActions } from '../../lib/api-client'

export const Route = createFileRoute('/clients/new')({
  component: CreateClientPage,
})

// Business-only has no confirm/SMS step — submits directly
type Step = 'type-select' | 'individual-form' | 'business-form' | 'confirm'

interface FormErrors {
  basic?: Partial<Record<keyof BasicInfoData, string>>
  business?: Partial<Record<keyof BusinessInfoData, string>>
}

const currentYear = new Date().getFullYear()
const TAX_YEARS = [currentYear - 1, currentYear - 2, currentYear - 3]

/** Format a US phone string as +1XXXXXXXXXX */
const toE164Phone = (phone: string) => `+1${phone.replace(/\D/g, '').slice(0, 10)}`

/** Sanitize email: strip control chars, limit length */
const sanitizeEmail = (email: string) =>
  // eslint-disable-next-line no-control-regex
  email ? email.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 254).trim() : undefined

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC','PR','VI','GU','AS','MP',
])

function CreateClientPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Wizard state
  const [clientCreationType, setClientCreationType] = useState<ClientCreationType | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('type-select')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  // Returning client detection (individual paths only)
  const [existingClient, setExistingClient] = useState<ClientWithActions | null>(null)
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [copyFromEngagementId, setCopyFromEngagementId] = useState<string | null>(null)

  // Shared tax year across all paths
  const [taxYear, setTaxYear] = useState(currentYear - 1)

  // Individual form data
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    firstName: '', lastName: '', phone: '', email: '',
    language: 'VI', taxYear: currentYear - 1,
  })

  // Keep taxYear in sync with basicInfo for individual paths
  const handleTaxYearChange = (year: number) => {
    setTaxYear(year)
    setBasicInfo(prev => ({ ...prev, taxYear: year }))
  }

  // Business form data
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoData>(EMPTY_BUSINESS_INFO)

  // SMS templates (for individual paths with confirm step)
  const [customMessages, setCustomMessages] = useState({ VI: DEFAULT_SMS_TEMPLATE_VI, EN: DEFAULT_SMS_TEMPLATE_EN })
  const currentMessage = customMessages[basicInfo.language]
  const handleMessageChange = useCallback((message: string) => {
    setCustomMessages(prev => ({ ...prev, [basicInfo.language]: message }))
  }, [basicInfo.language])

  // Returning client check
  const checkExistingClient = useCallback(async (phone: string) => {
    const cleanedPhone = phone.replace(/\D/g, '')
    if (cleanedPhone.length !== 10) { setExistingClient(null); return }
    setIsCheckingPhone(true)
    try {
      const client = await api.clients.searchByPhone(phone)
      setExistingClient(client)
      if (client && !basicInfo.firstName) {
        setBasicInfo(prev => ({ ...prev, firstName: client.firstName, lastName: client.lastName || '' }))
      }
    } catch {
      setExistingClient(null)
    } finally {
      setIsCheckingPhone(false)
    }
  }, [basicInfo.firstName])

  const handleCopyFromPrevious = useCallback((engagementId: string | null, shouldCopy: boolean) => {
    setCopyFromEngagementId(shouldCopy ? engagementId : null)
  }, [])

  // --- Type selection ---
  const handleTypeSelect = (type: ClientCreationType) => {
    setClientCreationType(type)
    setCurrentStep(type === 'BUSINESS' ? 'business-form' : 'individual-form')
  }

  // --- Validation ---
  const validateBasicInfo = (): boolean => {
    const e: Partial<Record<keyof BasicInfoData, string>> = {}
    if (!basicInfo.firstName.trim()) e.firstName = t('newClient.errorFirstNameRequired')
    if (!basicInfo.lastName.trim()) e.lastName = t('newClient.errorLastNameRequired')
    const cleaned = basicInfo.phone.replace(/\D/g, '')
    if (!cleaned) e.phone = t('newClient.errorPhoneRequired')
    else if (cleaned.length !== 10) e.phone = t('newClient.errorPhoneLength')
    if (basicInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicInfo.email)) {
      e.email = t('newClient.errorEmailInvalid')
    }
    setErrors(prev => ({ ...prev, basic: e }))
    return Object.keys(e).length === 0
  }

  const validateBusinessInfo = (): boolean => {
    const e: Partial<Record<keyof BusinessInfoData, string>> = {}
    if (!businessInfo.name.trim()) e.name = t('newClient.errorBusinessNameRequired', 'Business name is required')
    if (businessInfo.ein && !/^\d{2}-\d{7}$/.test(businessInfo.ein)) {
      e.ein = t('newClient.errorEinFormat', 'EIN must be XX-XXXXXXX format')
    }
    if (businessInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessInfo.email)) {
      e.email = t('newClient.errorEmailInvalid')
    }
    // Phone required for business-only (no individual phone to fall back on)
    if (clientCreationType === 'BUSINESS') {
      const cleaned = businessInfo.phone.replace(/\D/g, '')
      if (!cleaned) e.phone = t('newClient.errorPhoneRequired')
      else if (cleaned.length !== 10) e.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')
    } else if (businessInfo.phone) {
      const cleaned = businessInfo.phone.replace(/\D/g, '')
      if (cleaned.length > 0 && cleaned.length !== 10) e.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')
    }
    if (businessInfo.state && (businessInfo.state.length !== 2 || !US_STATES.has(businessInfo.state))) {
      e.state = t('newClient.errorStateFormat', 'Invalid state code')
    }
    if (businessInfo.zip && !/^\d{5}(-\d{4})?$/.test(businessInfo.zip)) e.zip = t('newClient.errorZipFormat', 'Invalid ZIP')
    setErrors(prev => ({ ...prev, business: e }))
    return Object.keys(e).length === 0
  }

  // --- Navigation ---
  const handleNext = () => {
    if (currentStep === 'individual-form') {
      if (!validateBasicInfo()) return
      setCurrentStep(clientCreationType === 'INDIVIDUAL_WITH_BUSINESS' ? 'business-form' : 'confirm')
    } else if (currentStep === 'business-form') {
      // Only INDIVIDUAL_WITH_BUSINESS reaches here; BUSINESS submits inline
      if (!validateBusinessInfo()) return
      setCurrentStep('confirm')
    }
  }

  const handleBack = () => {
    if (currentStep === 'individual-form' || (currentStep === 'business-form' && clientCreationType === 'BUSINESS')) {
      setCurrentStep('type-select')
      setClientCreationType(null)
    } else if (currentStep === 'business-form') {
      setCurrentStep('individual-form')
    } else if (currentStep === 'confirm') {
      setCurrentStep(clientCreationType === 'INDIVIDUAL' ? 'individual-form' : 'business-form')
    }
  }

  // --- Submit ---
  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (clientCreationType === 'INDIVIDUAL') {
        if (existingClient) {
          await api.engagements.create({
            clientId: existingClient.id,
            taxYear: basicInfo.taxYear,
            copyFromEngagementId: copyFromEngagementId ?? undefined,
          })
          navigate({ to: '/clients/$clientId', params: { clientId: existingClient.id } })
        } else {
          const response = await api.clients.create({
            firstName: basicInfo.firstName.trim().slice(0, 50),
            lastName: basicInfo.lastName.trim().slice(0, 50),
            phone: toE164Phone(basicInfo.phone),
            email: sanitizeEmail(basicInfo.email) || undefined,
            language: basicInfo.language,
            profile: { taxYear: basicInfo.taxYear, taxTypes: ['FORM_1040'] },
            customMessage: currentMessage,
          })
          navigate({ to: '/clients/$clientId', params: { clientId: response.client.id } })
        }
      } else if (clientCreationType === 'INDIVIDUAL_WITH_BUSINESS') {
        const response = await api.clients.createWithBusiness({
          individual: {
            firstName: basicInfo.firstName.trim().slice(0, 50),
            lastName: basicInfo.lastName.trim().slice(0, 50),
            phone: toE164Phone(basicInfo.phone),
            email: sanitizeEmail(basicInfo.email) || undefined,
            language: basicInfo.language,
            profile: { taxYear: basicInfo.taxYear, taxTypes: ['FORM_1040'] },
          },
          business: {
            firstName: businessInfo.name.trim().slice(0, 100),
            phone: businessInfo.phone ? toE164Phone(businessInfo.phone) : toE164Phone(basicInfo.phone),
            email: sanitizeEmail(businessInfo.email) || undefined,
            language: basicInfo.language,
            businessType: businessInfo.businessType,
            ein: businessInfo.ein || undefined,
            businessAddress: businessInfo.address.trim() || undefined,
            businessCity: businessInfo.city.trim() || undefined,
            businessState: businessInfo.state.trim() || undefined,
            businessZip: businessInfo.zip.trim() || undefined,
            profile: { taxYear: taxYear },
          },
          groupName: `${basicInfo.firstName.trim()} ${basicInfo.lastName.trim()} Group`,
          customMessage: currentMessage,
        })
        navigate({ to: '/clients/$clientId', params: { clientId: response.data.individual.id } })
      } else if (clientCreationType === 'BUSINESS') {
        const response = await api.clients.create({
          firstName: businessInfo.name.trim().slice(0, 100),
          phone: toE164Phone(businessInfo.phone),
          email: sanitizeEmail(businessInfo.email) || undefined,
          clientType: 'BUSINESS',
          businessType: businessInfo.businessType,
          ein: businessInfo.ein || undefined,
          businessAddress: businessInfo.address.trim() || undefined,
          businessCity: businessInfo.city.trim() || undefined,
          businessState: businessInfo.state.trim() || undefined,
          businessZip: businessInfo.zip.trim() || undefined,
          profile: { taxYear: taxYear },
        })
        navigate({ to: '/clients/$clientId', params: { clientId: response.client.id } })
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to create client:', error)
      setSubmitError(error instanceof Error ? error.message : t('newClient.errorCreateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step indicator ---
  const getSteps = () => {
    if (!clientCreationType || clientCreationType === 'INDIVIDUAL') {
      return [
        { id: 'individual-form', label: t('newClient.stepBasicInfo'), icon: User },
        { id: 'confirm', label: t('newClient.stepConfirm'), icon: Check },
      ]
    }
    if (clientCreationType === 'BUSINESS') {
      return [{ id: 'business-form', label: 'Business Info', icon: Building2 }]
    }
    return [
      { id: 'individual-form', label: t('newClient.stepBasicInfo'), icon: User },
      { id: 'business-form', label: 'Business Info', icon: Building2 },
      { id: 'confirm', label: t('newClient.stepConfirm'), icon: Check },
    ]
  }
  const steps = getSteps()
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const clientName = clientCreationType === 'BUSINESS'
    ? businessInfo.name
    : (basicInfo.lastName ? `${basicInfo.firstName} ${basicInfo.lastName}` : basicInfo.firstName)

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{UI_TEXT.clients.backToList}</span>
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{UI_TEXT.clients.newClient}</h1>
      </div>

      {/* Step Indicator (hidden on type-select) */}
      {currentStep !== 'type-select' && steps.length > 1 && (
        <StepIndicator steps={steps} currentStep={currentStep} currentStepIndex={currentStepIndex} />
      )}

      {/* Form Content */}
      <div className="max-w-2xl mx-auto">
        {/* Type Select */}
        {currentStep === 'type-select' && (
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
            <ClientTypeSelector onSelect={handleTypeSelect} />
          </div>
        )}

        {/* Individual Form */}
        {currentStep === 'individual-form' && (
          <>
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                <BasicInfoForm
                  data={basicInfo}
                  onChange={(updates) => setBasicInfo(prev => ({ ...prev, ...updates }))}
                  errors={errors.basic}
                  onPhoneBlur={checkExistingClient}
                  isCheckingPhone={isCheckingPhone}
                  taxYears={TAX_YEARS}
                />
              </div>
              {existingClient && (
                <ReturningClientSection
                  client={existingClient}
                  selectedTaxYear={basicInfo.taxYear}
                  onCopyFromPrevious={handleCopyFromPrevious}
                />
              )}
            </div>
            <WizardNavButtons onBack={handleBack} onNext={handleNext} nextLabel={t('newClient.continue')} backLabel={t('newClient.goBack')} />
          </>
        )}

        {/* Business Form */}
        {currentStep === 'business-form' && (
          <>
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
              <BusinessInfoForm
                data={businessInfo}
                onChange={(updates) => setBusinessInfo(prev => ({ ...prev, ...updates }))}
                errors={errors.business}
                phoneRequired={clientCreationType === 'BUSINESS'}
              />
              {/* Tax Year selector for business-only path */}
              {clientCreationType === 'BUSINESS' && (
                <div className="mt-5 space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('newClient.taxYear')}
                    <span className="text-error ml-1">*</span>
                  </label>
                  <div className="flex gap-2">
                    {TAX_YEARS.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => handleTaxYearChange(year)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          taxYear === year ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Business-only: submit directly (no SMS confirm) */}
            {clientCreationType === 'BUSINESS' ? (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => { if (validateBusinessInfo()) handleSubmit() }}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium',
                    'bg-primary text-white transition-colors',
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'
                  )}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Create Business Client</>
                  )}
                </button>
                {submitError && (
                  <div className="p-4 bg-error-light rounded-lg text-error text-sm">{submitError}</div>
                )}
                <div className="flex justify-start">
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
              </div>
            ) : (
              <WizardNavButtons onBack={handleBack} onNext={handleNext} nextLabel={t('newClient.continue')} backLabel={t('newClient.goBack')} />
            )}
          </>
        )}

        {/* Confirm Step (Individual and Individual+Business paths only) */}
        {currentStep === 'confirm' && (
          <>
            {clientCreationType === 'INDIVIDUAL_WITH_BUSINESS' && (
              <div className="mb-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2">Creating linked records:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. Individual: {basicInfo.firstName} {basicInfo.lastName}</li>
                  <li>2. Business: {businessInfo.name}</li>
                  <li>3. Group: {basicInfo.firstName} {basicInfo.lastName} Group</li>
                </ul>
              </div>
            )}
            <ConfirmStep
              clientName={clientName}
              phone={basicInfo.phone}
              taxYear={basicInfo.taxYear}
              language={basicInfo.language}
              onLanguageChange={(lang) => setBasicInfo(prev => ({ ...prev, language: lang }))}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              customMessage={currentMessage}
              onMessageChange={handleMessageChange}
            />
            {submitError && (
              <div className="mt-4 p-4 bg-error-light rounded-lg text-error text-sm">{submitError}</div>
            )}
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

// --- Sub-components ---

function StepIndicator({ steps, currentStep, currentStepIndex }: {
  steps: { id: string; label: string; icon: typeof User }[]
  currentStep: string
  currentStepIndex: number
}) {
  return (
    <nav className="mb-8" aria-label="Progress">
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.id === currentStep
          const isComplete = index < currentStepIndex
          return (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                isComplete || isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              )}>
                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={cn(
                'ml-2 text-sm font-medium hidden sm:inline',
                isActive || isComplete ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={cn('w-16 sm:w-24 h-0.5 mx-4', index < currentStepIndex ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function WizardNavButtons({ onBack, onNext, nextLabel, backLabel }: { onBack: () => void; onNext: () => void; nextLabel: string; backLabel: string }) {
  return (
    <div className="flex justify-between mt-6">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium',
          'border border-border text-foreground hover:bg-muted transition-colors'
        )}
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        className={cn(
          'flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium',
          'bg-primary text-white hover:bg-primary-dark transition-colors'
        )}
      >
        {nextLabel}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}
