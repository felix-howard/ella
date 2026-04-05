/**
 * Contractor Intake Form - Collects contractor info for 1099-NEC filing
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export interface ContractorFormData {
  firstName: string
  lastName: string
  ssn: string
  tinType: 'SSN' | 'EIN'
  address: string
  city: string
  state: string
  zip: string
  email?: string
  phone?: string
}

interface ContractorIntakeFormProps {
  onSubmit: (data: ContractorFormData) => Promise<void>
  isSubmitting: boolean
  error?: string
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'

function formatSsn(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function ContractorIntakeForm({ onSubmit, isSubmitting, error }: ContractorIntakeFormProps) {
  const { t } = useTranslation()
  const submittingRef = useRef(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ssnDisplay, setSsnDisplay] = useState('')
  const [tinType, setTinType] = useState<'SSN' | 'EIN'>('SSN')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const handleSsnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSsnDisplay(formatSsn(e.target.value))
  }

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    ssnDisplay.replace(/\D/g, '').length === 9 &&
    address.trim().length > 0 &&
    city.trim().length > 0 &&
    state.length > 0 &&
    /^\d{5}(-?\d{4})?$/.test(zip.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current || !isValid) return
    submittingRef.current = true

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ssn: ssnDisplay.replace(/\D/g, ''),
        tinType,
        address: address.trim(),
        city: city.trim(),
        state,
        zip: zip.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ci-firstName" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.firstName')} <span className="text-destructive">*</span>
          </label>
          <input
            id="ci-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            required
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="ci-lastName" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.lastName')} <span className="text-destructive">*</span>
          </label>
          <input
            id="ci-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            required
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.tinType')}
        </label>
        <div className="flex gap-4">
          {(['SSN', 'EIN'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tinType"
                value={type}
                checked={tinType === type}
                onChange={() => setTinType(type)}
                disabled={isSubmitting}
                className="accent-primary"
              />
              <span className="text-sm text-foreground">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="ci-ssn" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.ssn')} <span className="text-destructive">*</span>
        </label>
        <input
          id="ci-ssn"
          type="text"
          value={ssnDisplay}
          onChange={handleSsnChange}
          placeholder="XXX-XX-XXXX"
          className={inputClass}
          required
          disabled={isSubmitting}
          inputMode="numeric"
        />
      </div>

      <div>
        <label htmlFor="ci-address" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.address')} <span className="text-destructive">*</span>
        </label>
        <input
          id="ci-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
          required
          maxLength={500}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ci-city" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.city')} <span className="text-destructive">*</span>
          </label>
          <input
            id="ci-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
            required
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="ci-state" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.state')} <span className="text-destructive">*</span>
          </label>
          <select
            id="ci-state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={inputClass}
            required
            disabled={isSubmitting}
          >
            <option value="">--</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ci-zip" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.zip')} <span className="text-destructive">*</span>
        </label>
        <input
          id="ci-zip"
          type="text"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="XXXXX"
          className={inputClass}
          required
          maxLength={10}
          disabled={isSubmitting}
          inputMode="numeric"
        />
      </div>

      <div>
        <label htmlFor="ci-email" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.email')}
        </label>
        <input
          id="ci-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="ci-phone" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.phone')}
        </label>
        <input
          id="ci-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          disabled={isSubmitting}
        />
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
            {t('contractorIntake.submitting')}
          </>
        ) : (
          t('contractorIntake.submit')
        )}
      </Button>
    </form>
  )
}
