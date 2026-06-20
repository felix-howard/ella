/**
 * Wizard Step 3 (CONSENT_7216 variant) — fixed document confirmation.
 * Staff cannot customize the consent document; taxpayer fields are collected
 * later in the portal signing flow.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck, Loader2, X } from 'lucide-react'
import {
  EXPIRY_DAYS_DEFAULT,
  EXPIRY_DAYS_MAX,
  EXPIRY_DAYS_MIN,
  EXPIRY_DAYS_PRESETS,
} from './step3-content-editor'

export interface ConsentSendConfirmResolved {
  expiryDays: number
}

interface Props {
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (resolved: ConsentSendConfirmResolved) => void
}

const CONSENT_TITLE = 'Consent to Use and Disclose Tax Return Information'

export function Step3ConsentSendConfirm({ isSubmitting, onCancel, onSubmit }: Props) {
  const { t } = useTranslation()
  const [expiryDays, setExpiryDays] = useState(EXPIRY_DAYS_DEFAULT)

  const expiryValid =
    Number.isInteger(expiryDays) && expiryDays >= EXPIRY_DAYS_MIN && expiryDays <= EXPIRY_DAYS_MAX
  const canSubmit = expiryValid && !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ expiryDays })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
            <FileCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t('agreements.wizard.consent.title')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('agreements.wizard.consent.description')}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('agreements.wizard.fields.titleLabel')}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{CONSENT_TITLE}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground">
          {t('agreements.wizard.sendSettingsTitle')}
        </p>

        <div className="mt-4">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('agreements.wizard.fields.expiryDaysLabel')}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={EXPIRY_DAYS_MIN}
              max={EXPIRY_DAYS_MAX}
              step={1}
              value={expiryDays}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10)
                setExpiryDays(Number.isFinite(next) ? next : EXPIRY_DAYS_DEFAULT)
              }}
              disabled={isSubmitting}
              className="h-11 w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">
              {t('agreements.wizard.fields.expiryDaysUnit')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXPIRY_DAYS_PRESETS.map((preset) => {
              const active = expiryDays === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setExpiryDays(preset)}
                  disabled={isSubmitting}
                  className={
                    'min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ' +
                    (active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted')
                  }
                >
                  {preset}d
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t('agreements.wizard.fields.expiryDaysHint')}
          </p>
          {!expiryValid && (
            <p className="mt-1 text-xs text-destructive">
              {t('agreements.wizard.fields.expiryDaysInvalid', {
                min: EXPIRY_DAYS_MIN,
                max: EXPIRY_DAYS_MAX,
              })}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileCheck className="h-4 w-4" />
            )}
            {t('agreements.wizard.consent.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
