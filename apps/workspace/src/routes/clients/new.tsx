/**
 * Create Client Page - Simplified wizard for adding new clients
 * Combined form with inline "owns business" toggle
 * Steps: form (with optional business accordion) -> confirm & send
 */

import { useState, useCallback } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, User, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import {
  ReturningClientSection,
  ConfirmStep,
  DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  ensurePortalLinkPlaceholder,
  getClientSmsTemplate,
  BusinessAccordion,
  BasicInfoForm,
  EMPTY_BUSINESS_INFO,
  type ClientSmsTemplateId,
  type BusinessInfoData,
  type BasicInfoData,
} from '../../components/clients'
import { UI_TEXT } from '../../lib/constants'
import { api, type ClientWithActions } from '../../lib/api-client'

export const Route = createFileRoute('/clients/new')({
  component: CreateClientPage,
})

type Step = 'form' | 'confirm'

interface FormErrors {
  basic?: Partial<Record<keyof BasicInfoData, string>>
  businesses?: Partial<Record<keyof BusinessInfoData, string>>[]
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
  const [currentStep, setCurrentStep] = useState<Step>('form')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  // Returning client detection (individual paths only)
  const [existingClient, setExistingClient] = useState<ClientWithActions | null>(null)
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [copyFromEngagementId, setCopyFromEngagementId] = useState<string | null>(null)

  // Individual form data
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    firstName: '', lastName: '', phone: '', email: '',
    language: 'VI', taxYear: currentYear - 1,
    hasBusiness: null,  // null = not selected
  })

  // Business form data — array for when hasBusiness=true

  type BusinessEntry = BusinessInfoData & { _key: string }
  const makeBizEntry = (): BusinessEntry => ({ ...EMPTY_BUSINESS_INFO, _key: crypto.randomUUID() })

  const [businesses, setBusinesses] = useState<BusinessEntry[]>(() => [makeBizEntry()])
  const [expandedBizIndex, setExpandedBizIndex] = useState(0)

  const updateBusiness = (index: number, updates: Partial<BusinessInfoData>) => {
    setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b))
  }
  const addBusiness = () => {
    if (businesses.length >= 10) return
    setBusinesses(prev => {
      const next = [...prev, makeBizEntry()]
      setExpandedBizIndex(next.length - 1)
      return next
    })
  }
  const removeBusiness = (index: number) => {
    setBusinesses(prev => prev.filter((_, i) => i !== index))
    setExpandedBizIndex(prev => prev >= index ? Math.max(0, prev - 1) : prev)
  }

  // SMS templates (for individual paths with confirm step)
  const [selectedTemplateId, setSelectedTemplateId] = useState<ClientSmsTemplateId>(DEFAULT_CLIENT_SMS_TEMPLATE_ID)
  const [customMessages, setCustomMessages] = useState(() => ({
    VI: getClientSmsTemplate(DEFAULT_CLIENT_SMS_TEMPLATE_ID, 'VI'),
    EN: getClientSmsTemplate(DEFAULT_CLIENT_SMS_TEMPLATE_ID, 'EN'),
  }))
  const currentMessage = customMessages[basicInfo.language]
  const handleMessageChange = useCallback((message: string) => {
    setCustomMessages(prev => ({ ...prev, [basicInfo.language]: message }))
  }, [basicInfo.language])
  const handleTemplateSelect = useCallback((templateId: ClientSmsTemplateId) => {
    setSelectedTemplateId(templateId)
    setCustomMessages({
      VI: getClientSmsTemplate(templateId, 'VI'),
      EN: getClientSmsTemplate(templateId, 'EN'),
    })
  }, [])

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
    // Require business selection
    if (basicInfo.hasBusiness === null) {
      e.hasBusiness = t('newClient.errorBusinessSelectionRequired', 'Please select Yes or No')
    }
    setErrors(prev => ({ ...prev, basic: e }))
    return Object.keys(e).length === 0
  }

  const validateSingleBusiness = (biz: BusinessInfoData, phoneRequired: boolean): Partial<Record<keyof BusinessInfoData, string>> => {
    const e: Partial<Record<keyof BusinessInfoData, string>> = {}
    if (!biz.name.trim()) e.name = t('newClient.errorBusinessNameRequired', 'Business name is required')
    if (biz.ein && !/^\d{2}-\d{7}$/.test(biz.ein)) e.ein = t('newClient.errorEinFormat', 'EIN must be XX-XXXXXXX format')
    if (biz.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(biz.email)) e.email = t('newClient.errorEmailInvalid')
    if (phoneRequired) {
      const cleaned = biz.phone.replace(/\D/g, '')
      if (!cleaned) e.phone = t('newClient.errorPhoneRequired')
      else if (cleaned.length !== 10) e.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')
    } else if (biz.phone) {
      const cleaned = biz.phone.replace(/\D/g, '')
      if (cleaned.length > 0 && cleaned.length !== 10) e.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')
    }
    if (biz.state && (biz.state.length !== 2 || !US_STATES.has(biz.state))) e.state = t('newClient.errorStateFormat', 'Invalid state code')
    if (biz.zip && !/^\d{5}(-\d{4})?$/.test(biz.zip)) e.zip = t('newClient.errorZipFormat', 'Invalid ZIP')
    return e
  }

  const validateAllBusinesses = (): boolean => {
    let firstErrorIndex = -1
    const allErrors = businesses.map((biz, index) => {
      const e = validateSingleBusiness(biz, false)
      if (Object.keys(e).length > 0 && firstErrorIndex === -1) firstErrorIndex = index
      return e
    })
    setErrors(prev => ({ ...prev, businesses: allErrors }))
    if (firstErrorIndex >= 0) setExpandedBizIndex(firstErrorIndex)
    return allErrors.every(e => Object.keys(e).length === 0)
  }

  // --- Navigation ---
  const handleNext = () => {
    if (currentStep === 'form') {
      if (!validateBasicInfo()) return
      if (basicInfo.hasBusiness && !validateAllBusinesses()) return
      setCurrentStep('confirm')
    }
  }

  const handleBack = () => {
    if (currentStep === 'form') {
      navigate({ to: '/clients' })
    } else if (currentStep === 'confirm') {
      setCurrentStep('form')
    }
  }

  // --- Submit ---
  const handleSubmit = async () => {
    if (isSubmitting) return
    const messageWithPortalLink = ensurePortalLinkPlaceholder(currentMessage)
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (basicInfo.hasBusiness) {
        // Create individual + businesses
        const response = await api.clients.createWithBusiness({
          individual: {
            firstName: basicInfo.firstName.trim().slice(0, 50),
            lastName: basicInfo.lastName.trim().slice(0, 50),
            phone: toE164Phone(basicInfo.phone),
            email: sanitizeEmail(basicInfo.email) || undefined,
            language: basicInfo.language,
            profile: { taxYear: basicInfo.taxYear, taxTypes: ['FORM_1040'] },
          },
          businesses: businesses.map(biz => ({
            firstName: biz.name.trim().slice(0, 100),
            phone: biz.phone ? toE164Phone(biz.phone) : toE164Phone(basicInfo.phone),
            email: sanitizeEmail(biz.email) || undefined,
            language: basicInfo.language,
            businessType: biz.businessType,
            ein: biz.ein || undefined,
            businessAddress: biz.address.trim() || undefined,
            businessCity: biz.city.trim() || undefined,
            businessState: biz.state.trim() || undefined,
            businessZip: biz.zip.trim() || undefined,
            profile: { taxYear: basicInfo.taxYear },
          })),
          groupName: `${basicInfo.firstName.trim()} ${basicInfo.lastName.trim()} Group`,
          customMessage: messageWithPortalLink,
        })
        navigate({ to: '/clients/$clientId', params: { clientId: response.data.individual.id } })
      } else {
        // Individual only
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
            customMessage: messageWithPortalLink,
          })
          navigate({ to: '/clients/$clientId', params: { clientId: response.client.id } })
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to create client:', error)
      setSubmitError(error instanceof Error ? error.message : t('newClient.errorCreateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Step indicator ---
  const steps = [
    { id: 'form', label: t('newClient.stepBasicInfo'), icon: User },
    { id: 'confirm', label: t('newClient.stepConfirm'), icon: Check },
  ]
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const clientName = basicInfo.lastName ? `${basicInfo.firstName} ${basicInfo.lastName}` : basicInfo.firstName

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

      {/* Step Indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} currentStepIndex={currentStepIndex} />

      {/* Form Content */}
      <div className="max-w-2xl mx-auto">
        {/* Combined Form Step */}
        {currentStep === 'form' && (
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
                  showBusinessToggle
                />
              </div>

              {/* Returning client section - only show when no business (individual only creates engagement) */}
              {existingClient && basicInfo.hasBusiness === false && (
                <ReturningClientSection
                  client={existingClient}
                  selectedTaxYear={basicInfo.taxYear}
                  onCopyFromPrevious={handleCopyFromPrevious}
                />
              )}

              {/* Business accordion - inline expand when Yes */}
              {basicInfo.hasBusiness && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <BusinessAccordion
                    businesses={businesses}
                    expandedIndex={expandedBizIndex}
                    onExpandedChange={setExpandedBizIndex}
                    onUpdate={updateBusiness}
                    onAdd={addBusiness}
                    onRemove={removeBusiness}
                    errors={errors.businesses}
                  />
                </div>
              )}
            </div>

            <WizardNavButtons
              onBack={handleBack}
              onNext={handleNext}
              nextLabel={t('newClient.continue')}
              backLabel={t('newClient.cancel')}
            />
          </>
        )}

        {/* Confirm Step */}
        {currentStep === 'confirm' && (
          <>
            {basicInfo.hasBusiness && (
              <div className="mb-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2">Creating linked records:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. Individual: {basicInfo.firstName} {basicInfo.lastName}</li>
                  {businesses.map((biz, i) => (
                    <li key={biz._key}>{i + 2}. Business: {biz.name} ({biz.businessType.replace('_', ' ')})</li>
                  ))}
                  <li>{businesses.length + 2}. Group: {basicInfo.firstName} {basicInfo.lastName} Group</li>
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
              selectedTemplateId={selectedTemplateId}
              onTemplateSelect={handleTemplateSelect}
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
