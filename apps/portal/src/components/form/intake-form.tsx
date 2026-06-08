/**
 * Intake Form - Single-step self-registration form.
 * Mirrors the internal "Add Client" Basic Info flow:
 *   First Name*, Last Name*, Phone*, Email, Tax Year, "File business taxes too?" toggle.
 * When toggle = Yes, an accordion of one or more businesses is shown — the user
 * can add up to 10 with the "Add Another Business" button.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import {
  IntakeBusinessAccordion,
  MAX_BUSINESSES,
  type IntakeBusinessEntry,
} from './intake-business-accordion'
import { EMPTY_BUSINESS_DATA, type IntakeBusinessData } from './intake-business-form'
import { formatPhoneUS } from '../../lib/format-phone'

export type IntakeClientType = 'INDIVIDUAL' | 'INDIVIDUAL_WITH_BUSINESS'

/** Shape sent to the submit handler — businesses normalized to the API contract. */
export interface IntakeFormData {
  clientType: IntakeClientType
  firstName: string
  lastName: string
  phone: string
  email: string
  taxYear: number
  businesses?: IntakeBusinessSubmit[]
}

export interface IntakeBusinessSubmit {
  name: string
  businessType?: string
  ein?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

interface IntakeFormProps {
  onSubmit: (data: IntakeFormData) => Promise<void>
  isSubmitting: boolean
  error?: string
}

const currentYear = new Date().getFullYear()
const taxYears = [currentYear - 1, currentYear - 2, currentYear - 3]

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'

let businessKeySeq = 0
const newBusinessEntry = (): IntakeBusinessEntry => ({
  ...EMPTY_BUSINESS_DATA,
  _key: `biz-${++businessKeySeq}`,
})

/** Trim a value, return undefined when empty so the API doesn't get empty strings. */
const optional = (v: string) => {
  const t = v.trim()
  return t.length > 0 ? t : undefined
}

/** Convert UI business state to the API submit shape (drop empty fields). */
function toSubmitBusiness(biz: IntakeBusinessData): IntakeBusinessSubmit | null {
  const name = biz.businessName.trim()
  if (!name) return null
  const phoneDigits = biz.businessPhone.replace(/\D/g, '')
  return {
    name,
    businessType: biz.businessType || undefined,
    ein: optional(biz.businessEin),
    phone: phoneDigits ? `+1${phoneDigits}` : undefined,
    email: optional(biz.businessEmail),
    address: optional(biz.businessAddress),
    city: optional(biz.businessCity),
    state: optional(biz.businessState),
    zip: optional(biz.businessZip),
  }
}

export function IntakeForm({ onSubmit, isSubmitting, error }: IntakeFormProps) {
  const { t } = useTranslation()
  const submittingRef = useRef(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [taxYear, setTaxYear] = useState(currentYear - 1)
  // Default to "Yes" — most clients are business owners, so the business section
  // is shown by default to cut a click for the common case. Individuals click "No".
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(true)
  const [businesses, setBusinesses] = useState<IntakeBusinessEntry[]>(() => [newBusinessEntry()])
  const [expandedIndex, setExpandedIndex] = useState(0)

  const phoneDigits = phone.replace(/\D/g, '')
  const isIndividualValid =
    firstName.trim().length > 0 && lastName.trim().length > 0 && phoneDigits.length === 10
  const isBusinessValid =
    hasBusiness === true ? businesses.every((b) => b.businessName.trim().length > 0) : true
  const canSubmit = isIndividualValid && hasBusiness !== null && isBusinessValid

  const updateBusiness = (index: number, updates: Partial<IntakeBusinessData>) => {
    setBusinesses((prev) => prev.map((b, i) => (i === index ? { ...b, ...updates } : b)))
  }

  const addBusiness = () => {
    if (businesses.length >= MAX_BUSINESSES) return
    setBusinesses((prev) => {
      const next = [...prev, newBusinessEntry()]
      setExpandedIndex(next.length - 1)
      return next
    })
  }

  const removeBusiness = (index: number) => {
    setBusinesses((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index)
      setExpandedIndex((cur) => Math.min(cur, next.length - 1))
      return next
    })
  }

  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return
    submittingRef.current = true

    const clientType: IntakeClientType = hasBusiness ? 'INDIVIDUAL_WITH_BUSINESS' : 'INDIVIDUAL'
    const submitBusinesses = hasBusiness
      ? businesses
          .map(toSubmitBusiness)
          .filter((b): b is IntakeBusinessSubmit => b !== null)
      : undefined

    try {
      await onSubmit({
        clientType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `+1${phoneDigits}`,
        email: email.trim(),
        taxYear,
        businesses: submitBusinesses,
      })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <h2 className="text-lg font-semibold text-primary">{t('form.basicInfoTitle')}</h2>

      {/* First Name + Last Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="intake-firstName" className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.firstName')} <span className="text-destructive">*</span>
          </label>
          <input
            id="intake-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t('form.firstNamePlaceholder')}
            className={inputClass}
            required
            maxLength={50}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="intake-lastName" className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.lastName')} <span className="text-destructive">*</span>
          </label>
          <input
            id="intake-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('form.lastNamePlaceholder')}
            className={inputClass}
            required
            maxLength={50}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="intake-phone" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.phone')} <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+1</span>
          <input
            id="intake-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneUS(e.target.value))}
            placeholder="XXX XXX XXXX"
            className={`${inputClass} pl-10`}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="intake-email" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.email')}
        </label>
        <input
          id="intake-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('form.emailPlaceholder')}
          className={inputClass}
          disabled={isSubmitting}
        />
      </div>

      {/* Tax Year - button pill selector (matches internal) */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.taxYear')} <span className="text-destructive">*</span>
        </label>
        <div className="flex gap-2">
          {taxYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setTaxYear(year)}
              disabled={isSubmitting}
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

      {/* Business toggle */}
      <div className="space-y-2 pt-4 border-t border-border">
        <label id="has-business-label" className="block text-sm font-medium text-foreground">
          {t('form.ownsBusiness')} <span className="text-destructive">*</span>
        </label>
        <div className="flex gap-4" role="radiogroup" aria-labelledby="has-business-label">
          <BusinessRadio
            checked={hasBusiness === true}
            onSelect={() => setHasBusiness(true)}
            label={t('form.yes')}
            disabled={isSubmitting}
          />
          <BusinessRadio
            checked={hasBusiness === false}
            onSelect={() => setHasBusiness(false)}
            label={t('form.no')}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Multi-business accordion when Yes */}
      {hasBusiness === true && (
        <div className="pt-2 space-y-3">
          <h3 className="text-base font-semibold text-primary">{t('form.businessInfo')}</h3>
          <IntakeBusinessAccordion
            businesses={businesses}
            expandedIndex={expandedIndex}
            onExpandedChange={setExpandedIndex}
            onUpdate={updateBusiness}
            onAdd={addBusiness}
            onRemove={removeBusiness}
          />
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="pt-2">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full py-3 rounded-xl font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('form.submitting')}
            </>
          ) : (
            t('form.submit')
          )}
        </Button>
      </div>
    </div>
  )
}

function BusinessRadio({
  checked,
  onSelect,
  label,
  disabled,
}: {
  checked: boolean
  onSelect: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input
        type="radio"
        name="hasBusiness"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={cn(
          'w-4 h-4 rounded-full border-2 flex items-center justify-center',
          checked ? 'border-primary' : 'border-muted-foreground'
        )}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}
