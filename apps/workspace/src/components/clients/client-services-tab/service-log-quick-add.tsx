import { useState, type FormEvent } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import type { CreateClientServiceLogInput } from '../../../lib/api-client'
import { ServiceLogFormFields } from './service-log-form-fields'
import {
  buildServiceLogPayload,
  getDefaultFormValues,
  type ServiceLogFormFieldChange,
} from './service-log-form-utils'

type ServiceLogQuickAddProps = {
  defaultTaxYear?: number | null
  isSubmitting: boolean
  onSubmit: (payload: CreateClientServiceLogInput) => Promise<void>
}

export function ServiceLogQuickAdd({
  defaultTaxYear,
  isSubmitting,
  onSubmit,
}: ServiceLogQuickAddProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState(() => getDefaultFormValues(defaultTaxYear))
  const [error, setError] = useState<string | null>(null)

  const setField: ServiceLogFormFieldChange = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildServiceLogPayload(values, t)
    if (result.error || !result.payload) {
      setError(result.error ?? t('clientServices.saveError'))
      return
    }

    try {
      await onSubmit(result.payload)
      setValues(getDefaultFormValues(defaultTaxYear))
      setError(null)
    } catch {
      setError(t('clientServices.createError'))
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('clientServices.quickAddTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('clientServices.quickAddDescription')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <ServiceLogFormFields
          values={values}
          onChange={setField}
          noteId="client-service-quick-note"
          noteRows={2}
          denseMobile
          gridClassName="grid grid-cols-2 gap-3 md:grid-cols-[1.35fr_1fr_0.7fr_0.9fr]"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : <span />}
          <Button type="submit" disabled={isSubmitting} className="min-h-11">
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isSubmitting ? t('clientServices.adding') : t('clientServices.addService')}
          </Button>
        </div>
      </form>
    </section>
  )
}
