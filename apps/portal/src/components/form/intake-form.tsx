/**
 * Intake Form - Multi-step wizard for client self-registration
 * Step 1: Type selector (Personal / Personal+Business / Business Only)
 * Step 2+: Form fields based on selection
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@ella/ui'
import { IntakeTypeSelector, type IntakeClientType } from './intake-type-selector'
import { IntakeBusinessForm, EMPTY_BUSINESS_DATA, type IntakeBusinessData } from './intake-business-form'
import { formatPhoneUS } from '../../lib/format-phone'

export interface IntakeFormData {
  clientType: IntakeClientType
  firstName: string
  lastName: string
  phone: string
  email: string
  taxYear: number
  // Business fields (for INDIVIDUAL_WITH_BUSINESS and BUSINESS paths)
  businessName?: string
  businessType?: string
  businessEin?: string
  businessPhone?: string
  businessEmail?: string
  businessAddress?: string
  businessCity?: string
  businessState?: string
  businessZip?: string
}

interface IntakeFormProps {
  onSubmit: (data: IntakeFormData) => Promise<void>
  isSubmitting: boolean
  error?: string
}

type Step = 'type-select' | 'individual-form' | 'business-form'

const currentYear = new Date().getFullYear()
const taxYears = [currentYear - 1, currentYear - 2, currentYear - 3]

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'

export function IntakeForm({ onSubmit, isSubmitting, error }: IntakeFormProps) {
  const { t } = useTranslation()
  const submittingRef = useRef(false)

  // Wizard state
  const [clientType, setClientType] = useState<IntakeClientType | null>(null)
  const [step, setStep] = useState<Step>('type-select')

  // Individual fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [taxYear, setTaxYear] = useState(currentYear - 1)

  // Business fields
  const [bizData, setBizData] = useState<IntakeBusinessData>(EMPTY_BUSINESS_DATA)

  // Type selection
  const handleTypeSelect = (type: IntakeClientType) => {
    setClientType(type)
    setStep(type === 'BUSINESS' ? 'business-form' : 'individual-form')
  }

  // Navigation
  const handleBack = () => {
    if (step === 'individual-form' || (step === 'business-form' && clientType === 'BUSINESS')) {
      setStep('type-select')
      setClientType(null)
    } else if (step === 'business-form') {
      setStep('individual-form')
    }
  }

  const handleNext = () => {
    if (step === 'individual-form' && clientType === 'INDIVIDUAL_WITH_BUSINESS') {
      setStep('business-form')
    }
  }

  // Validation
  const isIndividualValid = firstName.trim().length > 0 && lastName.trim().length > 0 && phone.replace(/\D/g, '').length === 10
  const isBusinessValid = bizData.businessName.trim().length > 0
  const isBusinessPhoneValid = clientType === 'BUSINESS' ? bizData.businessPhone.replace(/\D/g, '').length === 10 : true

  const canSubmitIndividual = isIndividualValid && clientType === 'INDIVIDUAL'
  const canSubmitBusiness = isBusinessValid && isBusinessPhoneValid && clientType === 'BUSINESS'
  const isBusinessPhoneValidCombo = clientType === 'INDIVIDUAL_WITH_BUSINESS' ? bizData.businessPhone.replace(/\D/g, '').length === 10 : true
  const canSubmitCombo = isIndividualValid && isBusinessValid && isBusinessPhoneValidCombo && step === 'business-form' && clientType === 'INDIVIDUAL_WITH_BUSINESS'
  const canGoNext = isIndividualValid && clientType === 'INDIVIDUAL_WITH_BUSINESS' && step === 'individual-form'

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true

    const phoneDigits = phone.replace(/\D/g, '')
    const bizPhoneDigits = bizData.businessPhone.replace(/\D/g, '')

    try {
      await onSubmit({
        clientType: clientType!,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `+1${phoneDigits}`,
        email: email.trim(),
        taxYear,
        ...(clientType !== 'INDIVIDUAL' ? {
          businessName: bizData.businessName.trim(),
          businessType: bizData.businessType,
          businessEin: bizData.businessEin || undefined,
          businessPhone: bizPhoneDigits ? `+1${bizPhoneDigits}` : undefined,
          businessEmail: bizData.businessEmail.trim() || undefined,
          businessAddress: bizData.businessAddress.trim() || undefined,
          businessCity: bizData.businessCity.trim() || undefined,
          businessState: bizData.businessState.trim() || undefined,
          businessZip: bizData.businessZip.trim() || undefined,
        } : {}),
      })
    } finally {
      submittingRef.current = false
    }
  }

  // Step 1: Type selector
  if (step === 'type-select') {
    return <IntakeTypeSelector onSelect={handleTypeSelect} />
  }

  // Step 2: Individual form (INDIVIDUAL and INDIVIDUAL_WITH_BUSINESS)
  if (step === 'individual-form') {
    return (
      <div className="px-6 py-6 space-y-4">
        <h3 className="text-base font-semibold text-primary">{t('form.yourInfo')}</h3>
        <IndividualFields
          firstName={firstName} setFirstName={setFirstName}
          lastName={lastName} setLastName={setLastName}
          phone={phone} setPhone={(v) => setPhone(formatPhoneUS(v))}
          email={email} setEmail={setEmail}
          taxYear={taxYear} setTaxYear={setTaxYear}
          isSubmitting={isSubmitting} t={t}
        />
        {error && <ErrorBanner message={error} />}

        {clientType === 'INDIVIDUAL' ? (
          <div className="space-y-3 pt-2">
            <Button type="button" onClick={handleSubmit} disabled={!canSubmitIndividual || isSubmitting} className="w-full py-3 rounded-xl font-medium">
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('form.submitting')}</> : t('form.submit')}
            </Button>
            <BackButton onClick={handleBack} label={t('form.back')} />
          </div>
        ) : (
          <div className="flex justify-between pt-2">
            <BackButton onClick={handleBack} label={t('form.back')} />
            <button type="button" onClick={handleNext} disabled={!canGoNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('form.next')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // Step 2 (BUSINESS) or Step 3 (INDIVIDUAL_WITH_BUSINESS): Business form
  return (
    <div className="px-6 py-6 space-y-4">
      <IntakeBusinessForm
        data={bizData}
        onChange={(updates) => setBizData((prev) => ({ ...prev, ...updates }))}
        phoneRequired={clientType === 'BUSINESS' || clientType === 'INDIVIDUAL_WITH_BUSINESS'}
      />

      {/* Tax Year for business-only path */}
      {clientType === 'BUSINESS' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.taxYear')} <span className="text-destructive">*</span>
          </label>
          <select value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} className={inputClass}>
            {taxYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="space-y-3 pt-2">
        <Button type="button" onClick={handleSubmit}
          disabled={!(canSubmitBusiness || canSubmitCombo) || isSubmitting}
          className="w-full py-3 rounded-xl font-medium">
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('form.submitting')}</> : t('form.submit')}
        </Button>
        <BackButton onClick={handleBack} label={t('form.back')} />
      </div>
    </div>
  )
}

// --- Sub-components ---

function IndividualFields({ firstName, setFirstName, lastName, setLastName, phone, setPhone, email, setEmail, taxYear, setTaxYear, isSubmitting, t }: {
  firstName: string; setFirstName: (v: string) => void
  lastName: string; setLastName: (v: string) => void
  phone: string; setPhone: (v: string) => void
  email: string; setEmail: (v: string) => void
  taxYear: number; setTaxYear: (v: number) => void
  isSubmitting: boolean; t: (k: string) => string
}) {
  return (
    <>
      <div>
        <label htmlFor="intake-firstName" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.firstName')} <span className="text-destructive">*</span>
        </label>
        <input id="intake-firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
          placeholder={t('form.firstNamePlaceholder')} className={inputClass} required maxLength={50} disabled={isSubmitting} />
      </div>
      <div>
        <label htmlFor="intake-lastName" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.lastName')} <span className="text-destructive">*</span>
        </label>
        <input id="intake-lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
          placeholder={t('form.lastNamePlaceholder')} className={inputClass} required maxLength={50} disabled={isSubmitting} />
      </div>
      <div>
        <label htmlFor="intake-phone" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.phone')} <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+1</span>
          <input id="intake-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="XXX XXX XXXX" className={`${inputClass} pl-10`} required disabled={isSubmitting} />
        </div>
      </div>
      <div>
        <label htmlFor="intake-email" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.email')}
        </label>
        <input id="intake-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t('form.emailPlaceholder')} className={inputClass} disabled={isSubmitting} />
      </div>
      <div>
        <label htmlFor="intake-taxYear" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.taxYear')} <span className="text-destructive">*</span>
        </label>
        <select id="intake-taxYear" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))}
          className={inputClass} disabled={isSubmitting}>
          {taxYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{message}</div>
  )
}
