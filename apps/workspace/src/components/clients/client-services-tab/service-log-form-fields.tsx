import { useTranslation } from 'react-i18next'
import { InputField, SelectField } from '@ella/ui'
import type {
  ServiceLogFormFieldChange,
  ServiceLogFormValues,
} from './service-log-form-utils'
import { SERVICE_TYPE_OPTIONS, STATUS_OPTIONS } from './service-log-labels'

type ServiceLogFormFieldsProps = {
  values: ServiceLogFormValues
  onChange: ServiceLogFormFieldChange
  noteId: string
  noteRows?: number
  gridClassName?: string
  denseMobile?: boolean
}

export function ServiceLogFormFields({
  values,
  onChange,
  noteId,
  noteRows = 3,
  gridClassName = 'grid gap-3 sm:grid-cols-2',
  denseMobile = false,
}: ServiceLogFormFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className={gridClassName}>
        <SelectField
          className={denseMobile ? 'col-span-2 md:col-span-1' : undefined}
          label={t('clientServices.serviceTypeLabel')}
          value={values.serviceType}
          onChange={(event) =>
            onChange('serviceType', event.target.value as ServiceLogFormValues['serviceType'])
          }
          options={SERVICE_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
        <SelectField
          label={t('clientServices.statusLabel')}
          value={values.status}
          onChange={(event) =>
            onChange('status', event.target.value as ServiceLogFormValues['status'])
          }
          options={STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
        <InputField
          label={t('clientServices.taxYearLabel')}
          inputMode="numeric"
          maxLength={4}
          value={values.taxYear}
          onChange={(event) => onChange('taxYear', event.target.value)}
          placeholder={t('clientServices.taxYearPlaceholder')}
        />
        <InputField
          label={t('clientServices.serviceDateLabel')}
          type="date"
          required
          value={values.serviceDate}
          onChange={(event) => onChange('serviceDate', event.target.value)}
        />
      </div>

      {values.serviceType === 'OTHER' && (
        <InputField
          label={t('clientServices.customServiceLabel')}
          maxLength={100}
          value={values.customServiceName}
          onChange={(event) => onChange('customServiceName', event.target.value)}
          placeholder={t('clientServices.customServicePlaceholder')}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-xs font-medium text-foreground">
          {t('clientServices.noteLabel')}
        </label>
        <textarea
          id={noteId}
          rows={noteRows}
          maxLength={5000}
          value={values.note}
          onChange={(event) => onChange('note', event.target.value)}
          placeholder={t('clientServices.notePlaceholder')}
          className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </>
  )
}
