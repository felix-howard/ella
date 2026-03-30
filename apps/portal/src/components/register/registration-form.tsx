/**
 * Registration Form - Lead capture form with validation
 * Fields: firstName, lastName, phone (required), email, businessName (optional)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegistrationFormData } from '../../lib/form-api'

interface RegistrationFormProps {
  onSubmit: (data: RegistrationFormData) => void
  isSubmitting: boolean
  error?: string
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function RegistrationForm({ onSubmit, isSubmitting, error }: RegistrationFormProps) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit({ firstName, lastName, phone, email, businessName })
    }
  }

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 ${hasError ? 'border-destructive' : 'border-border'}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6">
      {/* First Name */}
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">
          {t('register.firstName')} <span className="text-destructive">*</span>
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder={t('register.firstNamePlaceholder')}
          className={inputClass(!!errors.firstName)}
          disabled={isSubmitting}
        />
        {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName}</p>}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">
          {t('register.lastName')} <span className="text-destructive">*</span>
        </label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder={t('register.lastNamePlaceholder')}
          className={inputClass(!!errors.lastName)}
          disabled={isSubmitting}
        />
        {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
          {t('register.phone')} <span className="text-destructive">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder={t('register.phonePlaceholder')}
          className={inputClass(!!errors.phone)}
          disabled={isSubmitting}
        />
        {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
      </div>

      {/* Email (optional) */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          {t('register.email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('register.emailPlaceholder')}
          className={inputClass(!!errors.email)}
          disabled={isSubmitting}
        />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
      </div>

      {/* Business Name (optional) */}
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-foreground mb-1">
          {t('register.businessName')}
        </label>
        <input
          id="businessName"
          type="text"
          autoComplete="organization"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={t('register.businessNamePlaceholder')}
          className={inputClass(false)}
          disabled={isSubmitting}
        />
      </div>

      {/* Submit Error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-4 rounded-lg text-primary-foreground font-medium transition-colors ${
          isSubmitting
            ? 'bg-primary/70 cursor-not-allowed'
            : 'bg-primary hover:bg-primary/90'
        }`}
      >
        {isSubmitting ? t('register.submitting') : t('register.submit')}
      </button>
    </form>
  )
}
