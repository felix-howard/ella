import { Input } from '@ella/ui'
import { useTranslation } from 'react-i18next'

export interface AgreementConsentFieldValues {
  taxpayerName: string
  businessName: string
  tinLastFour: string
}

export interface AgreementConsentTouched {
  taxpayerName: boolean
  tinLastFour: boolean
}

interface AgreementConsentFieldsProps {
  values: AgreementConsentFieldValues
  errors: {
    taxpayerName?: string
    tinLastFour?: string
  }
  submitting: boolean
  onChange: (values: AgreementConsentFieldValues) => void
  onBlur: (field: keyof AgreementConsentTouched) => void
}

export function normalizeTinLastFour(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits
}

export function getConsentErrorVisibility(
  canValidate: boolean,
  touched: AgreementConsentTouched
): AgreementConsentTouched {
  return {
    taxpayerName: canValidate && touched.taxpayerName,
    tinLastFour: canValidate && touched.tinLastFour,
  }
}

export function AgreementConsentFields({
  values,
  errors,
  submitting,
  onChange,
  onBlur,
}: AgreementConsentFieldsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-3.5">
      <div>
        <label
          className="block text-sm font-medium text-foreground mb-1.5"
          htmlFor="consent-taxpayer-name"
        >
          {t('nda.consent.taxpayerNameLabel')}
        </label>
        <Input
          id="consent-taxpayer-name"
          value={values.taxpayerName}
          onChange={(e) => onChange({ ...values, taxpayerName: e.target.value })}
          onBlur={() => onBlur('taxpayerName')}
          placeholder={t('nda.consent.taxpayerNamePlaceholder')}
          maxLength={160}
          disabled={submitting}
          autoComplete="name"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.taxpayerName)}
          aria-describedby={errors.taxpayerName ? 'consent-taxpayer-name-error' : undefined}
          variant={errors.taxpayerName ? 'error' : 'default'}
          className="focus:ring-1 focus:ring-primary/30"
        />
        {errors.taxpayerName && (
          <p id="consent-taxpayer-name-error" className="mt-1 text-xs text-error">
            {errors.taxpayerName}
          </p>
        )}
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground mb-1.5"
          htmlFor="consent-business-name"
        >
          {t('nda.consent.businessNameLabel')}
        </label>
        <Input
          id="consent-business-name"
          value={values.businessName}
          onChange={(e) => onChange({ ...values, businessName: e.target.value })}
          placeholder={t('nda.consent.businessNamePlaceholder')}
          maxLength={200}
          disabled={submitting}
          autoComplete="organization"
          className="focus:ring-1 focus:ring-primary/30"
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground mb-1.5"
          htmlFor="consent-tin-last-four"
        >
          {t('nda.consent.tinLastFourLabel')}
        </label>
        <Input
          id="consent-tin-last-four"
          value={values.tinLastFour}
          onChange={(e) =>
            onChange({ ...values, tinLastFour: normalizeTinLastFour(e.target.value) })
          }
          onBlur={() => onBlur('tinLastFour')}
          placeholder={t('nda.consent.tinLastFourPlaceholder')}
          inputMode="numeric"
          maxLength={9}
          pattern="[0-9]{4}"
          disabled={submitting}
          autoComplete="off"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.tinLastFour)}
          aria-describedby="consent-tin-last-four-hint"
          variant={errors.tinLastFour ? 'error' : 'default'}
          className="focus:ring-1 focus:ring-primary/30"
        />
        <p
          id="consent-tin-last-four-hint"
          className={`mt-1 text-xs ${errors.tinLastFour ? 'text-error' : 'text-muted-foreground'}`}
        >
          {errors.tinLastFour ?? t('nda.consent.tinLastFourHint')}
        </p>
      </div>
    </div>
  )
}
