import { useTranslation } from 'react-i18next'
import { InputField } from '@ella/ui'
import {
  formatLeadPhoneInput,
  type EditLeadFormData,
  type EditLeadFormErrors,
} from './edit-lead-modal-utils'

interface EditLeadModalFieldsProps {
  form: EditLeadFormData
  errors: EditLeadFormErrors
  isSaving: boolean
  canEditPhone: boolean
  updateField: (key: keyof EditLeadFormData, value: string) => void
}

export function EditLeadModalFields({
  form,
  errors,
  isSaving,
  canEditPhone,
  updateField,
}: EditLeadModalFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField
          label={`${t('leads.firstName', 'First Name')} *`}
          value={form.firstName}
          onChange={(event) => updateField('firstName', event.target.value)}
          disabled={isSaving}
          error={errors.firstName}
          aria-invalid={Boolean(errors.firstName)}
          maxLength={100}
          autoComplete="given-name"
        />
        <InputField
          label={`${t('leads.lastName', 'Last Name')} *`}
          value={form.lastName}
          onChange={(event) => updateField('lastName', event.target.value)}
          disabled={isSaving}
          error={errors.lastName}
          aria-invalid={Boolean(errors.lastName)}
          maxLength={100}
          autoComplete="family-name"
        />
      </div>

      <InputField
        label={`${t('leads.phone', 'Phone')} *`}
        type="tel"
        value={form.phone}
        onChange={(event) => updateField('phone', formatLeadPhoneInput(event.target.value))}
        placeholder="(555) 123-4567"
        disabled={isSaving || !canEditPhone}
        error={errors.phone}
        hint={
          !canEditPhone
            ? t('leads.phoneMaskedHint', 'Only admins can edit masked phone numbers.')
            : undefined
        }
        aria-invalid={Boolean(errors.phone)}
        autoComplete="tel"
      />

      <InputField
        label={t('leads.email', 'Email')}
        type="email"
        value={form.email}
        onChange={(event) => updateField('email', event.target.value)}
        placeholder={t('leads.emailPlaceholder', 'email@example.com')}
        disabled={isSaving}
        error={errors.email}
        aria-invalid={Boolean(errors.email)}
        maxLength={254}
        autoComplete="email"
      />

      <InputField
        label={t('leads.businessName', 'Business Name')}
        value={form.businessName}
        onChange={(event) => updateField('businessName', event.target.value)}
        disabled={isSaving}
        maxLength={200}
        autoComplete="organization"
      />
    </>
  )
}
