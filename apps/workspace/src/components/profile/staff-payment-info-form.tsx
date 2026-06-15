import { useState, type FormEvent } from 'react'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { Button, InputField } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { StaffPaymentCountry, StaffPaymentInfoSummary, UpdateStaffPaymentInfoInput } from '../../lib/api-client'
import {
  hasPaymentInfoErrors,
  maskedEnding,
  validatePaymentInfoForm,
  type PaymentInfoFormErrors,
  type PaymentInfoFormValues,
} from './staff-payment-info-utils'

interface StaffPaymentInfoFormProps {
  country: StaffPaymentCountry
  paymentInfo: StaffPaymentInfoSummary | null
  canEdit: boolean
  isSaving: boolean
  isClearing: boolean
  onSave: (country: StaffPaymentCountry, data: UpdateStaffPaymentInfoInput) => void
  onClear: (country: StaffPaymentCountry) => void
}

function initialValues(paymentInfo: StaffPaymentInfoSummary | null): PaymentInfoFormValues {
  return {
    nameOnAccount: paymentInfo?.nameOnAccount ?? '',
    bankName: paymentInfo?.bankName ?? '',
    accountNumber: '',
    routingNumber: '',
  }
}

export function StaffPaymentInfoForm({
  country,
  paymentInfo,
  canEdit,
  isSaving,
  isClearing,
  onSave,
  onClear,
}: StaffPaymentInfoFormProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<PaymentInfoFormValues>(() => initialValues(paymentInfo))
  const [errors, setErrors] = useState<PaymentInfoFormErrors>({})
  const hasSavedInfo = Boolean(paymentInfo)
  const disabled = isSaving || isClearing

  const updateField = (field: keyof PaymentInfoFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const startEditing = () => {
    setValues(initialValues(paymentInfo))
    setErrors({})
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setValues(initialValues(paymentInfo))
    setErrors({})
    setIsEditing(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validatePaymentInfoForm(country, values)
    setErrors(nextErrors)
    if (hasPaymentInfoErrors(nextErrors)) return

    onSave(country, {
      nameOnAccount: values.nameOnAccount.trim(),
      bankName: values.bankName.trim(),
      accountNumber: values.accountNumber.trim(),
      ...(country === 'US' ? { routingNumber: values.routingNumber.trim() } : {}),
    })
  }

  if (!isEditing) {
    return (
      <div className="space-y-4">
        {paymentInfo ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadItem label={t('profile.paymentInfo.nameOnAccount')} value={paymentInfo.nameOnAccount} />
            <ReadItem label={t('profile.paymentInfo.bankName')} value={paymentInfo.bankName} />
            <ReadItem label={t('profile.paymentInfo.accountNumber')} value={maskedEnding(paymentInfo.accountNumberLast4)} />
            {country === 'US' && (
              <ReadItem label={t('profile.paymentInfo.routingNumber')} value={maskedEnding(paymentInfo.routingNumberLast4)} />
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {t('profile.paymentInfo.emptyCountry')}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {paymentInfo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onClear(country)}
                className="w-full sm:w-auto"
              >
                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('profile.paymentInfo.clear')}
              </Button>
            )}
            <Button type="button" size="sm" onClick={startEditing} className="w-full sm:w-auto">
              <Pencil className="h-4 w-4" />
              {paymentInfo ? t('profile.paymentInfo.edit') : t('profile.paymentInfo.add')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label={t('profile.paymentInfo.nameOnAccount')}
          value={values.nameOnAccount}
          error={errors.nameOnAccount ? t(errors.nameOnAccount) : undefined}
          onChange={(event) => updateField('nameOnAccount', event.target.value)}
          disabled={disabled}
          autoComplete="name"
        />
        <InputField
          label={t('profile.paymentInfo.bankName')}
          value={values.bankName}
          error={errors.bankName ? t(errors.bankName) : undefined}
          onChange={(event) => updateField('bankName', event.target.value)}
          disabled={disabled}
          autoComplete="organization"
        />
        <InputField
          label={t('profile.paymentInfo.accountNumber')}
          value={values.accountNumber}
          placeholder={hasSavedInfo ? maskedEnding(paymentInfo?.accountNumberLast4) : undefined}
          hint={hasSavedInfo ? t('profile.paymentInfo.fullReplacementHint') : undefined}
          error={errors.accountNumber ? t(errors.accountNumber) : undefined}
          onChange={(event) => updateField('accountNumber', event.target.value)}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
        />
        {country === 'US' && (
          <InputField
            label={t('profile.paymentInfo.routingNumber')}
            value={values.routingNumber}
            placeholder={hasSavedInfo ? maskedEnding(paymentInfo?.routingNumberLast4) : undefined}
            hint={hasSavedInfo ? t('profile.paymentInfo.fullReplacementHint') : undefined}
            error={errors.routingNumber ? t(errors.routingNumber) : undefined}
            onChange={(event) => updateField('routingNumber', event.target.value)}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
          />
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={cancelEditing} className="w-full sm:w-auto">
          <X className="h-4 w-4" />
          {t('profile.paymentInfo.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={disabled} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('profile.paymentInfo.save')}
        </Button>
      </div>
    </form>
  )
}

function ReadItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}
