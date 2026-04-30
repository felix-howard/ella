/**
 * Business info form for the public intake form.
 * Fields: name, type, EIN, phone, email, address (with Google Places), city, state, zip
 *
 * Supports rendering multiple instances on the same page via the `idPrefix` prop
 * (each instance must use a unique prefix so input ids stay unique).
 */
import { useTranslation } from 'react-i18next'
import { AddressAutocomplete } from '../contractor-intake/address-autocomplete'
import { formatPhoneUS } from '../../lib/format-phone'

export interface IntakeBusinessData {
  businessName: string
  businessType: string
  businessEin: string
  businessPhone: string
  businessEmail: string
  businessAddress: string
  businessCity: string
  businessState: string
  businessZip: string
}

export const EMPTY_BUSINESS_DATA: IntakeBusinessData = {
  businessName: '',
  businessType: 'LLC',
  businessEin: '',
  businessPhone: '',
  businessEmail: '',
  businessAddress: '',
  businessCity: '',
  businessState: '',
  businessZip: '',
}

const BUSINESS_TYPES = [
  { value: 'SOLE_PROPRIETORSHIP', labelKey: 'form.bizTypeSoleProp' },
  { value: 'LLC', labelKey: 'form.bizTypeLLC' },
  { value: 'PARTNERSHIP', labelKey: 'form.bizTypePartnership' },
  { value: 'S_CORP', labelKey: 'form.bizTypeSCorp' },
  { value: 'C_CORP', labelKey: 'form.bizTypeCCorp' },
]

interface IntakeBusinessFormProps {
  data: IntakeBusinessData
  onChange: (updates: Partial<IntakeBusinessData>) => void
  phoneRequired?: boolean
  /** Prefix for input ids — needed when multiple instances render on the same page. */
  idPrefix?: string
  /** Hide the section heading — used when the form is rendered inside an accordion that already shows the title. */
  hideTitle?: boolean
}

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'

export function IntakeBusinessForm({ data, onChange, phoneRequired, idPrefix = 'intake-', hideTitle }: IntakeBusinessFormProps) {
  const { t } = useTranslation()

  const formatEin = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
  }

  const id = (suffix: string) => `${idPrefix}biz${suffix}`

  return (
    <div className="space-y-4">
      {!hideTitle && <h3 className="text-base font-semibold text-primary">{t('form.businessInfo')}</h3>}

      {/* Business Name */}
      <div>
        <label htmlFor={id('Name')} className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.businessName')} <span className="text-destructive">*</span>
        </label>
        <input
          id={id('Name')}
          type="text"
          value={data.businessName}
          onChange={(e) => onChange({ businessName: e.target.value })}
          placeholder={t('form.businessNamePlaceholder')}
          className={inputClass}
          required
          maxLength={100}
        />
      </div>

      {/* Business Type + EIN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={id('Type')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.businessType')}
          </label>
          <select
            id={id('Type')}
            value={data.businessType}
            onChange={(e) => onChange({ businessType: e.target.value })}
            className={inputClass}
          >
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{t(bt.labelKey)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id('Ein')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.ein')}
          </label>
          <input
            id={id('Ein')}
            type="text"
            value={data.businessEin}
            onChange={(e) => onChange({ businessEin: formatEin(e.target.value) })}
            placeholder={t('form.einPlaceholder')}
            className={inputClass}
            maxLength={10}
          />
        </div>
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={id('Phone')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.businessPhone')} {phoneRequired && <span className="text-destructive">*</span>}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+1</span>
            <input
              id={id('Phone')}
              type="tel"
              value={data.businessPhone}
              onChange={(e) => onChange({ businessPhone: formatPhoneUS(e.target.value) })}
              placeholder="XXX XXX XXXX"
              className={`${inputClass} pl-10`}
              required={phoneRequired}
            />
          </div>
        </div>
        <div>
          <label htmlFor={id('Email')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.businessEmail')}
          </label>
          <input
            id={id('Email')}
            type="email"
            value={data.businessEmail}
            onChange={(e) => onChange({ businessEmail: e.target.value })}
            placeholder={t('form.emailPlaceholder')}
            className={inputClass}
          />
        </div>
      </div>

      {/* Address with Google Places autocomplete */}
      <div>
        <label htmlFor={id('Address')} className="block text-sm font-medium text-foreground mb-1.5">
          {t('form.street')}
        </label>
        <AddressAutocomplete
          id={id('Address')}
          value={data.businessAddress}
          onChange={(value) => onChange({ businessAddress: value })}
          onSelect={(result) => onChange({
            businessAddress: result.address,
            businessCity: result.city,
            businessState: result.state,
            businessZip: result.zip,
          })}
          placeholder={t('form.addressPlaceholder')}
          className={inputClass}
        />
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor={id('City')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.city')}
          </label>
          <input
            id={id('City')}
            type="text"
            value={data.businessCity}
            onChange={(e) => onChange({ businessCity: e.target.value })}
            placeholder={t('form.city')}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={id('State')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.state')}
          </label>
          <input
            id={id('State')}
            type="text"
            value={data.businessState}
            onChange={(e) => onChange({ businessState: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="CA"
            className={inputClass}
            maxLength={2}
          />
        </div>
        <div>
          <label htmlFor={id('Zip')} className="block text-sm font-medium text-foreground mb-1.5">
            {t('form.zip')}
          </label>
          <input
            id={id('Zip')}
            type="text"
            value={data.businessZip}
            onChange={(e) => onChange({ businessZip: e.target.value })}
            placeholder="12345"
            className={inputClass}
            maxLength={10}
          />
        </div>
      </div>
    </div>
  )
}
