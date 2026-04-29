/**
 * Basic info form for individual client creation.
 * Fields: firstName, lastName, phone, email, taxYear
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { UI_TEXT } from '../../lib/constants'
import { formatPhoneInput } from '../../lib/formatters'
import type { Language } from '../../lib/api-client'

export interface BasicInfoData {
  firstName: string
  lastName: string
  phone: string
  email: string
  language: Language
  taxYear: number
  hasBusiness: boolean | null  // null = not selected (force choice)
}

interface BasicInfoFormProps {
  data: BasicInfoData
  onChange: (data: Partial<BasicInfoData>) => void
  errors?: Partial<Record<keyof BasicInfoData, string>>
  onPhoneBlur?: (phone: string) => void
  isCheckingPhone?: boolean
  taxYears: number[]
  showBusinessToggle?: boolean  // Only show on combined form
}

export function BasicInfoForm({ data, onChange, errors, onPhoneBlur, isCheckingPhone, taxYears, showBusinessToggle }: BasicInfoFormProps) {
  const { t } = useTranslation()
  const handlePhoneChange = (value: string) => {
    onChange({ phone: formatPhoneInput(value) })
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-primary mb-4">{t('newClient.basicInfoTitle')}</h2>

      {/* First Name + Last Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="client-first-name" className="block text-sm font-medium text-foreground">
            {UI_TEXT.form.firstName}
            <span className="text-error ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="client-first-name"
            type="text"
            value={data.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder={t('newClient.firstNamePlaceholder')}
            aria-required="true"
            aria-invalid={!!errors?.firstName}
            aria-describedby={errors?.firstName ? 'first-name-error' : undefined}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border bg-card text-base text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'placeholder:text-muted-foreground/50',
              errors?.firstName ? 'border-error' : 'border-border'
            )}
          />
          {errors?.firstName && <p id="first-name-error" className="text-sm text-error" role="alert">{errors.firstName}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="client-last-name" className="block text-sm font-medium text-foreground">
            {UI_TEXT.form.lastName}
            <span className="text-error ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="client-last-name"
            type="text"
            value={data.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder={t('newClient.lastNamePlaceholder')}
            aria-required="true"
            aria-invalid={!!errors?.lastName}
            aria-describedby={errors?.lastName ? 'last-name-error' : undefined}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border bg-card text-base text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'placeholder:text-muted-foreground/50',
              errors?.lastName ? 'border-error' : 'border-border'
            )}
          />
          {errors?.lastName && <p id="last-name-error" className="text-sm text-error" role="alert">{errors.lastName}</p>}
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label htmlFor="client-phone" className="block text-sm font-medium text-foreground">
          {t('newClient.phoneLabel')}
          <span className="text-error ml-1" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <input
            id="client-phone"
            type="tel"
            value={data.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={() => onPhoneBlur?.(data.phone)}
            placeholder={t('newClient.phonePlaceholder')}
            aria-required="true"
            aria-invalid={!!errors?.phone}
            aria-describedby={errors?.phone ? 'phone-error' : undefined}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border bg-card text-base text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'placeholder:text-muted-foreground/50',
              errors?.phone ? 'border-error' : 'border-border'
            )}
          />
          {isCheckingPhone && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {errors?.phone && <p id="phone-error" className="text-sm text-error" role="alert">{errors.phone}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="client-email" className="block text-sm font-medium text-foreground">
          {UI_TEXT.form.email}
        </label>
        <input
          id="client-email"
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="email@example.com"
          aria-invalid={!!errors?.email}
          aria-describedby={errors?.email ? 'email-error' : undefined}
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-base text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'placeholder:text-muted-foreground/50',
            errors?.email ? 'border-error' : 'border-border'
          )}
        />
        {errors?.email && <p id="email-error" className="text-sm text-error" role="alert">{errors.email}</p>}
      </div>

      {/* Tax Year */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          {t('newClient.taxYear')}
          <span className="text-error ml-1">*</span>
        </label>
        <div className="flex gap-2">
          {taxYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => onChange({ taxYear: year })}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                data.taxYear === year ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Business Toggle */}
      {showBusinessToggle && (
        <div className="space-y-2 pt-4 border-t border-border mt-4">
          <label id="business-toggle-label" className="block text-sm font-medium text-foreground">
            {t('newClient.ownsBusiness', 'Do you want to file taxes for your business too?')}
            <span className="text-error ml-1">*</span>
          </label>
          <div className="flex gap-4" role="radiogroup" aria-labelledby="business-toggle-label">
            <label className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors',
              data.hasBusiness === false ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}>
              <input
                type="radio"
                name="hasBusiness"
                checked={data.hasBusiness === false}
                onChange={() => onChange({ hasBusiness: false })}
                className="sr-only"
              />
              <span className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                data.hasBusiness === false ? 'border-primary' : 'border-muted-foreground'
              )}>
                {data.hasBusiness === false && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              <span className="text-sm font-medium">No</span>
            </label>
            <label className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors',
              data.hasBusiness === true ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}>
              <input
                type="radio"
                name="hasBusiness"
                checked={data.hasBusiness === true}
                onChange={() => onChange({ hasBusiness: true })}
                className="sr-only"
              />
              <span className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                data.hasBusiness === true ? 'border-primary' : 'border-muted-foreground'
              )}>
                {data.hasBusiness === true && <span className="w-2 h-2 rounded-full bg-primary" />}
              </span>
              <span className="text-sm font-medium">Yes</span>
            </label>
          </div>
          {errors?.hasBusiness && (
            <p className="text-sm text-error" role="alert">{errors.hasBusiness}</p>
          )}
        </div>
      )}
    </div>
  )
}
