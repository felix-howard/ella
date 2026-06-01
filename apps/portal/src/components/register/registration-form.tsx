import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, BriefcaseBusiness, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RegistrationFormData } from '../../lib/form-api'

interface RegistrationFormProps {
  orgName: string
  onSubmit: (data: RegistrationFormData) => void
  isSubmitting: boolean
  error?: string
}
type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  icon: LucideIcon
  autoComplete: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  required?: boolean
  fullWidth?: boolean
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function RegistrationForm({
  orgName,
  onSubmit,
  isSubmitting,
  error,
}: RegistrationFormProps) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [smsConsentAccepted, setSmsConsentAccepted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) {
      newErrors.firstName = t('register.errors.firstNameRequired')
    }
    if (!lastName.trim()) {
      newErrors.lastName = t('register.errors.lastNameRequired')
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone) {
      newErrors.phone = t('register.errors.phoneRequired')
    } else if (cleanPhone.length !== 10) {
      newErrors.phone = t('register.errors.phoneInvalid')
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('register.errors.emailInvalid')
    }

    if (!smsConsentAccepted) {
      newErrors.smsConsent = t('register.errors.smsConsentRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit({ firstName, lastName, phone, email, businessName, smsConsentAccepted })
    }
  }

  const inputClass = (hasError: boolean) =>
    `peer h-12 w-full rounded-xl border bg-white px-11 text-base text-foreground shadow-sm transition duration-200 placeholder:text-muted-foreground/45 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
      hasError
        ? 'border-destructive/70 focus:border-destructive focus:ring-destructive/10'
        : 'border-border/80 hover:border-primary/40 focus:border-primary focus:ring-primary/15'
    }`

  const iconClass = (hasError: boolean) =>
    `pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
      hasError ? 'text-destructive' : 'text-muted-foreground/65 peer-focus:text-primary'
    }`

  const errorMessage = (field: string) =>
    errors[field] ? (
      <p
        id={`${field}-error`}
        className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {errors[field]}
      </p>
    ) : null

  const renderField = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    icon: Icon,
    autoComplete,
    type = 'text',
    inputMode,
    required = false,
    fullWidth = false,
  }: FieldProps) => {
    const hasError = !!errors[id]

    return (
      <div className={fullWidth ? 'sm:col-span-2' : undefined}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <div className="relative">
          <input
            id={id}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputClass(hasError)}
            disabled={isSubmitting}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
          />
          <Icon className={iconClass(hasError)} aria-hidden="true" />
        </div>
        {errorMessage(id)}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {renderField({
          id: 'firstName',
          label: t('register.firstName'),
          value: firstName,
          onChange: setFirstName,
          placeholder: t('register.firstNamePlaceholder'),
          icon: UserRound,
          autoComplete: 'given-name',
          required: true,
        })}
        {renderField({
          id: 'lastName',
          label: t('register.lastName'),
          value: lastName,
          onChange: setLastName,
          placeholder: t('register.lastNamePlaceholder'),
          icon: UserRound,
          autoComplete: 'family-name',
          required: true,
        })}
        {renderField({
          id: 'phone',
          label: t('register.phone'),
          value: phone,
          onChange: (value) => setPhone(formatPhone(value)),
          placeholder: t('register.phonePlaceholder'),
          icon: Phone,
          autoComplete: 'tel',
          type: 'tel',
          inputMode: 'tel',
          required: true,
        })}
        {renderField({
          id: 'email',
          label: t('register.email'),
          value: email,
          onChange: setEmail,
          placeholder: t('register.emailPlaceholder'),
          icon: Mail,
          autoComplete: 'email',
          type: 'email',
        })}
        {renderField({
          id: 'businessName',
          label: t('register.businessName'),
          value: businessName,
          onChange: setBusinessName,
          placeholder: t('register.businessNamePlaceholder'),
          icon: BriefcaseBusiness,
          autoComplete: 'organization',
          fullWidth: true,
        })}
      </div>

      <div className="mt-5">
        <label
          htmlFor="smsConsent"
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition duration-200 ${
            errors.smsConsent
              ? 'border-destructive/60 bg-destructive/5'
              : 'border-border/80 bg-muted/25 hover:border-primary/40 hover:bg-primary/5'
          }`}
        >
          <input
            id="smsConsent"
            type="checkbox"
            checked={smsConsentAccepted}
            onChange={(e) => setSmsConsentAccepted(e.target.checked)}
            disabled={isSubmitting}
            className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-border text-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            aria-invalid={!!errors.smsConsent}
            aria-describedby={errors.smsConsent ? 'smsConsent-error' : 'smsConsent-copy'}
          />
          <span id="smsConsent-copy" className="text-sm leading-6 text-muted-foreground">
            {t('register.smsConsent', { orgName })}
          </span>
        </label>
        {errorMessage('smsConsent')}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
          isSubmitting
            ? 'cursor-not-allowed bg-primary/70 shadow-none'
            : 'cursor-pointer bg-primary hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/25 active:translate-y-0'
        }`}
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? t('register.submitting') : t('register.submit')}
      </button>
    </form>
  )
}
