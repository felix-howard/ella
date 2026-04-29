/**
 * Business info form for the client creation wizard.
 * Fields: name, businessType, EIN (masked), phone, email, address, city, state, zip
 */
import { cn } from '@ella/ui'
import type { BusinessType } from '../../lib/api-client'
import { formatPhoneInput } from '../../lib/formatters'
import { AddressAutocomplete } from './address-autocomplete'

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
  { value: 'SMLLC', label: 'Single-Member LLC' },
  { value: 'LLC', label: 'LLC' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'S_CORP', label: 'S-Corp' },
  { value: 'C_CORP', label: 'C-Corp' },
]

export interface BusinessInfoData {
  name: string
  businessType: BusinessType
  ein: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
}

export const EMPTY_BUSINESS_INFO: BusinessInfoData = {
  name: '',
  businessType: 'LLC',
  ein: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zip: '',
}

interface BusinessInfoFormProps {
  data: BusinessInfoData
  onChange: (updates: Partial<BusinessInfoData>) => void
  errors?: Partial<Record<keyof BusinessInfoData, string>>
  /** Whether phone is required (true for business-only path) */
  phoneRequired?: boolean
  /** Prefix for HTML id attributes to avoid collisions with multiple instances */
  idPrefix?: string
  /** Hide the section title when rendered inside an accordion */
  hideTitle?: boolean
}

export function BusinessInfoForm({ data, onChange, errors, phoneRequired, idPrefix = 'biz-', hideTitle }: BusinessInfoFormProps) {
  // Auto-format EIN as XX-XXXXXXX
  const handleEinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
    onChange({ ein: formatted })
  }

  const handlePhoneChange = (value: string) => {
    onChange({ phone: formatPhoneInput(value) })
  }

  const inputClass = (field: keyof BusinessInfoData) =>
    cn(
      'w-full px-3 py-2.5 rounded-lg border bg-card text-base text-foreground',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
      'placeholder:text-muted-foreground/50',
      errors?.[field] ? 'border-error' : 'border-border'
    )

  return (
    <div className="space-y-5">
      {!hideTitle && <h2 className="text-lg font-semibold text-primary mb-4">Business Information</h2>}

      {/* Business Name */}
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}name`} className="block text-sm font-medium text-foreground">
          Business Name <span className="text-error ml-1" aria-hidden="true">*</span>
        </label>
        <input
          id={`${idPrefix}name`}
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Acme Corp"
          aria-required="true"
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? `${idPrefix}name-error` : undefined}
          className={inputClass('name')}
        />
        {errors?.name && <p id={`${idPrefix}name-error`} className="text-sm text-error" role="alert">{errors.name}</p>}
      </div>

      {/* Business Type + EIN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}type`} className="block text-sm font-medium text-foreground">
            Business Type
          </label>
          <select
            id={`${idPrefix}type`}
            value={data.businessType}
            onChange={(e) => onChange({ businessType: e.target.value as BusinessType })}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-base text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
            )}
          >
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}ein`} className="block text-sm font-medium text-foreground">
            EIN
          </label>
          <input
            id={`${idPrefix}ein`}
            type="text"
            value={data.ein}
            onChange={(e) => handleEinChange(e.target.value)}
            placeholder="XX-XXXXXXX"
            maxLength={10}
            aria-invalid={!!errors?.ein}
            aria-describedby={errors?.ein ? `${idPrefix}ein-error` : undefined}
            className={inputClass('ein')}
          />
          {errors?.ein && <p id={`${idPrefix}ein-error`} className="text-sm text-error" role="alert">{errors.ein}</p>}
        </div>
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}phone`} className="block text-sm font-medium text-foreground">
            Phone {phoneRequired && <span className="text-error ml-1" aria-hidden="true">*</span>}
          </label>
          <input
            id={`${idPrefix}phone`}
            type="tel"
            value={data.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="(555) 123-4567"
            aria-required={phoneRequired ? 'true' : undefined}
            aria-invalid={!!errors?.phone}
            aria-describedby={errors?.phone ? `${idPrefix}phone-error` : undefined}
            className={inputClass('phone')}
          />
          {errors?.phone && <p id={`${idPrefix}phone-error`} className="text-sm text-error" role="alert">{errors.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}email`} className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id={`${idPrefix}email`}
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="info@business.com"
            aria-invalid={!!errors?.email}
            aria-describedby={errors?.email ? `${idPrefix}email-error` : undefined}
            className={inputClass('email')}
          />
          {errors?.email && <p id={`${idPrefix}email-error`} className="text-sm text-error" role="alert">{errors.email}</p>}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}address`} className="block text-sm font-medium text-foreground">
          Street
        </label>
        <AddressAutocomplete
          id={`${idPrefix}address`}
          value={data.address}
          onChange={(value) => onChange({ address: value })}
          onSelect={(result) => onChange({
            address: result.address,
            city: result.city,
            state: result.state,
            zip: result.zip,
          })}
          placeholder="123 Main St"
          className={inputClass('address')}
        />
        {errors?.address && <p id={`${idPrefix}address-error`} className="text-sm text-error" role="alert">{errors.address}</p>}
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}city`} className="block text-sm font-medium text-foreground">
            City
          </label>
          <input
            id={`${idPrefix}city`}
            type="text"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="City"
            aria-invalid={!!errors?.city}
            aria-describedby={errors?.city ? `${idPrefix}city-error` : undefined}
            className={inputClass('city')}
          />
          {errors?.city && <p id={`${idPrefix}city-error`} className="text-sm text-error" role="alert">{errors.city}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}state`} className="block text-sm font-medium text-foreground">
            State
          </label>
          <input
            id={`${idPrefix}state`}
            type="text"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="CA"
            maxLength={2}
            aria-invalid={!!errors?.state}
            aria-describedby={errors?.state ? `${idPrefix}state-error` : undefined}
            className={inputClass('state')}
          />
          {errors?.state && <p id={`${idPrefix}state-error`} className="text-sm text-error" role="alert">{errors.state}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}zip`} className="block text-sm font-medium text-foreground">
            ZIP
          </label>
          <input
            id={`${idPrefix}zip`}
            type="text"
            value={data.zip}
            onChange={(e) => onChange({ zip: e.target.value })}
            placeholder="12345"
            maxLength={10}
            aria-invalid={!!errors?.zip}
            aria-describedby={errors?.zip ? `${idPrefix}zip-error` : undefined}
            className={inputClass('zip')}
          />
          {errors?.zip && <p id={`${idPrefix}zip-error`} className="text-sm text-error" role="alert">{errors.zip}</p>}
        </div>
      </div>
    </div>
  )
}
