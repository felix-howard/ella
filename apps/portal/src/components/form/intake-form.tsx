/**
 * Intake Form - Client self-registration form with phone masking
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'

interface IntakeFormProps {
  onSubmit: (data: IntakeFormData) => Promise<void>
  isSubmitting: boolean
  error?: string
}

export interface IntakeFormData {
  firstName: string
  lastName: string
  phone: string
  taxYear: number
}

const currentYear = new Date().getFullYear()
const taxYears = [currentYear, currentYear - 1, currentYear - 2]

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'

export function IntakeForm({ onSubmit, isSubmitting, error }: IntakeFormProps) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [taxYear, setTaxYear] = useState(currentYear)
  const submittingRef = useRef(false)

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    const cleaned = digits.startsWith('1') ? digits.slice(1) : digits
    const limited = cleaned.slice(0, 10)

    if (limited.length <= 3) return limited
    if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`
    return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true

    const phoneDigits = phone.replace(/\D/g, '')
    const e164Phone = `+1${phoneDigits}`

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: e164Phone,
        taxYear,
      })
    } finally {
      submittingRef.current = false
    }
  }

  const isValid = firstName.trim().length > 0 && phone.replace(/\D/g, '').length === 10

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
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
          {t('form.lastName')}
        </label>
        <input
          id="intake-lastName"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder={t('form.lastNamePlaceholder')}
          className={inputClass}
          maxLength={50}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="intake-phone" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.phone')} <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            +1
          </span>
          <input
            id="intake-phone"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="XXX XXX XXXX"
            className={`${inputClass} pl-10`}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <label htmlFor="intake-taxYear" className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.taxYear')} <span className="text-destructive">*</span>
        </label>
        <select
          id="intake-taxYear"
          value={taxYear}
          onChange={(e) => setTaxYear(Number(e.target.value))}
          className={inputClass}
          disabled={isSubmitting}
        >
          {taxYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full py-3 rounded-xl font-medium mt-2"
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
    </form>
  )
}
