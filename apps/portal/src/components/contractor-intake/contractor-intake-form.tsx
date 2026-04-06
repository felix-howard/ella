/**
 * Contractor Intake Form - Collects contractor info for 1099-NEC filing
 * Supports adding multiple contractors before batch submission
 */
import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Trash2, User } from 'lucide-react'
import { Button } from '@ella/ui'
import { AddressAutocomplete } from './address-autocomplete'

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
  amountBox1: string
  amountBox4?: string
}

/** Local entry with display SSN for the queue list */
export interface ContractorEntry extends ContractorFormData {
  ssnDisplay: string
}

interface ContractorIntakeFormProps {
  onSubmitAll: (entries: ContractorFormData[]) => Promise<void>
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

function formatEin(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

function formatTin(value: string, tinType: 'SSN' | 'EIN'): string {
  return tinType === 'EIN' ? formatEin(value) : formatSsn(value)
}

function formatCurrency(value: string): string {
  // Strip everything except digits and dot
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  // Only allow one decimal point, max 2 decimal places
  let intPart = parts[0] || ''
  // Remove leading zeros (but keep "0" alone)
  intPart = intPart.replace(/^0+(\d)/, '$1')
  const decPart = parts.length > 1 ? '.' + (parts.slice(1).join('').slice(0, 2)) : ''
  // Add thousand separators
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return formatted + decPart
}

/** Strip commas to get raw numeric value */
function parseCurrencyRaw(display: string): string {
  return display.replace(/,/g, '')
}

function maskSsn(ssn: string): string {
  return `***-**-${ssn.slice(-4)}`
}

/** Custom pill-style radio button group for TIN type */
function TinTypeRadio({
  value,
  onChange,
  disabled,
}: {
  value: 'SSN' | 'EIN'
  onChange: (v: 'SSN' | 'EIN') => void
  disabled?: boolean
}) {
  return (
    <div className="flex rounded-xl border border-border overflow-hidden">
      {(['SSN', 'EIN'] as const).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => !disabled && onChange(type)}
          disabled={disabled}
          className={`flex-1 px-5 py-2.5 text-sm font-medium transition-colors ${
            value === type
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {type}
        </button>
      ))}
    </div>
  )
}

function useContractorForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ssnDisplay, setSsnDisplay] = useState('')
  const [tinType, _setTinType] = useState<'SSN' | 'EIN'>('SSN')

  const setTinType = (type: 'SSN' | 'EIN') => {
    _setTinType(type)
    // Re-format existing digits into the new format
    const digits = ssnDisplay.replace(/\D/g, '')
    if (digits) setSsnDisplay(formatTin(digits, type))
  }
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [amountBox1, setAmountBox1] = useState('')
  const [amountBox4, setAmountBox4] = useState('')

  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    ssnDisplay.replace(/\D/g, '').length === 9 &&
    address.trim().length > 0 &&
    city.trim().length > 0 &&
    state.length > 0 &&
    /^\d{5}$/.test(zip.trim()) &&
    parseFloat(parseCurrencyRaw(amountBox1)) > 0

  const toFormData = (): ContractorFormData => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    ssn: ssnDisplay.replace(/\D/g, ''),
    tinType,
    address: address.trim(),
    city: city.trim(),
    state,
    zip: zip.trim(),
    amountBox1: parseCurrencyRaw(amountBox1),
    amountBox4: parseCurrencyRaw(amountBox4) || undefined,
  })

  const toEntry = (): ContractorEntry => ({
    ...toFormData(),
    ssnDisplay,
  })

  const reset = () => {
    setFirstName('')
    setLastName('')
    setSsnDisplay('')
    setTinType('SSN')
    setAddress('')
    setCity('')
    setState('')
    setZip('')
    setAmountBox1('')
    setAmountBox4('')
  }

  return {
    firstName, setFirstName,
    lastName, setLastName,
    ssnDisplay, setSsnDisplay,
    tinType, setTinType,
    address, setAddress,
    city, setCity,
    state, setState,
    zip, setZip,
    amountBox1, setAmountBox1,
    amountBox4, setAmountBox4,
    isValid,
    toFormData,
    toEntry,
    reset,
  }
}

export function ContractorIntakeForm({ onSubmitAll, isSubmitting, error }: ContractorIntakeFormProps) {
  const { t } = useTranslation()
  const form = useContractorForm()
  const [queue, setQueue] = useState<ContractorEntry[]>([])
  const [formError, setFormError] = useState('')
  const firstNameRef = useRef<HTMLInputElement>(null)

  const handleAddToQueue = () => {
    if (!form.isValid) return
    setQueue((prev) => [...prev, form.toEntry()])
    form.reset()
    setFormError('')
    firstNameRef.current?.focus()
  }

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddressSelect = useCallback((result: { address: string; city: string; state: string; zip: string }) => {
    form.setAddress(result.address)
    form.setCity(result.city)
    form.setState(result.state)
    form.setZip(result.zip)
  }, [form])

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault()

    // If form has data, add it to queue first
    let finalQueue = [...queue]
    if (form.firstName.trim() || form.lastName.trim()) {
      if (!form.isValid) {
        setFormError('Please complete all required fields for the current contractor before submitting.')
        return
      }
      finalQueue = [...finalQueue, form.toEntry()]
    }

    if (finalQueue.length === 0) {
      setFormError('Please add at least one contractor.')
      return
    }

    await onSubmitAll(finalQueue.map(({ ssnDisplay: _, ...data }) => data))
  }

  const totalContractors = queue.length + (form.isValid ? 1 : 0)

  return (
    <form onSubmit={handleSubmitAll} className="px-6 py-6 space-y-4">
      {/* Queued contractors list */}
      {queue.length > 0 && (
        <div className="space-y-2 mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('contractorIntake.contractorsAdded', { count: queue.length })}
          </p>
          {queue.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {entry.firstName} {entry.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.tinType}: {maskSsn(entry.ssn)} &middot; ${parseFloat(entry.amountBox1).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFromQueue(i)}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground text-center">
              Add another contractor below or submit all
            </p>
          </div>
        </div>
      )}

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ci-firstName" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.firstName')} <span className="text-destructive">*</span>
          </label>
          <input
            ref={firstNameRef}
            id="ci-firstName"
            type="text"
            value={form.firstName}
            onChange={(e) => form.setFirstName(e.target.value)}
            className={inputClass}
            required={queue.length === 0}
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
            value={form.lastName}
            onChange={(e) => form.setLastName(e.target.value)}
            className={inputClass}
            required={queue.length === 0}
            maxLength={100}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* TIN Type - custom radio */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.tinType')} <span className="text-destructive">*</span>
        </label>
        <TinTypeRadio value={form.tinType} onChange={form.setTinType} disabled={isSubmitting} />
      </div>

      {/* SSN/EIN */}
      <div>
        <label htmlFor="ci-ssn" className="block text-sm font-medium text-foreground mb-1.5">
          {form.tinType === 'EIN' ? 'EIN' : 'SSN / TIN'} <span className="text-destructive">*</span>
        </label>
        <input
          id="ci-ssn"
          type="text"
          value={form.ssnDisplay}
          onChange={(e) => form.setSsnDisplay(formatTin(e.target.value, form.tinType))}
          placeholder={form.tinType === 'EIN' ? 'XX-XXXXXXX' : 'XXX-XX-XXXX'}
          className={inputClass}
          required={queue.length === 0}
          disabled={isSubmitting}
          inputMode="numeric"
        />
      </div>

      {/* Address with autocomplete */}
      <div>
        <label htmlFor="ci-address" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.address')} <span className="text-destructive">*</span>
        </label>
        <AddressAutocomplete
          id="ci-address"
          value={form.address}
          onChange={form.setAddress}
          onSelect={handleAddressSelect}
          className={inputClass}
          required={queue.length === 0}
          disabled={isSubmitting}
        />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ci-city" className="block text-sm font-medium text-foreground mb-1.5">
            {t('contractorIntake.city')} <span className="text-destructive">*</span>
          </label>
          <input
            id="ci-city"
            type="text"
            value={form.city}
            onChange={(e) => form.setCity(e.target.value)}
            className={inputClass}
            required={queue.length === 0}
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
            value={form.state}
            onChange={(e) => form.setState(e.target.value)}
            className={inputClass}
            required={queue.length === 0}
            disabled={isSubmitting}
          >
            <option value="">--</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ZIP */}
      <div>
        <label htmlFor="ci-zip" className="block text-sm font-medium text-foreground mb-1.5">
          {t('contractorIntake.zip')} <span className="text-destructive">*</span>
        </label>
        <input
          id="ci-zip"
          type="text"
          value={form.zip}
          onChange={(e) => form.setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="XXXXX"
          className={inputClass}
          required={queue.length === 0}
          maxLength={5}
          disabled={isSubmitting}
          inputMode="numeric"
        />
      </div>

      {/* Income fields */}
      <div className="border-t border-border/50 pt-4 mt-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          1099-NEC Income
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ci-box1" className="block text-sm font-medium text-foreground mb-1.5">
              Box 1: Compensation <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                id="ci-box1"
                type="text"
                value={form.amountBox1}
                onChange={(e) => form.setAmountBox1(formatCurrency(e.target.value))}
                placeholder="0.00"
                className={`${inputClass} pl-8`}
                required={queue.length === 0}
                disabled={isSubmitting}
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ci-box4" className="block text-sm font-medium text-foreground mb-1.5">
              Box 4: Tax Withheld
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                id="ci-box4"
                type="text"
                value={form.amountBox4}
                onChange={(e) => form.setAmountBox4(formatCurrency(e.target.value))}
                placeholder="0.00"
                className={`${inputClass} pl-8`}
                disabled={isSubmitting}
                inputMode="decimal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error messages */}
      {(error || formError) && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error || formError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleAddToQueue}
          disabled={!form.isValid || isSubmitting}
          className="flex-1 py-3 rounded-xl font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add & Continue
        </Button>
        <Button
          type="submit"
          disabled={(totalContractors === 0) || isSubmitting}
          className="flex-1 py-3 rounded-xl font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('contractorIntake.submitting')}
            </>
          ) : (
            <>
              {t('contractorIntake.submit')}
              {totalContractors > 0 && ` (${totalContractors})`}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
