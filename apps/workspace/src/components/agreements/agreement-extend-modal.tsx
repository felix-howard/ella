/**
 * Extend-validity modal stacked above the agreement card. Lets staff push
 * `expiresAt` forward without rotating the token or sending SMS. Presets +
 * custom number input; default = the agreement's stored expiryDays.
 *
 * Server clamps to MIN/MAX, but we mirror the bounds client-side so the Apply
 * button is gated rather than letting the user hit a 422.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, X, Clock } from 'lucide-react'
import { useExtendAgreement } from './use-agreement-mutations'
import {
  EXPIRY_DAYS_MIN,
  EXPIRY_DAYS_MAX,
  EXPIRY_DAYS_PRESETS,
} from './wizard-steps/step3-content-editor'
import { getExpiryStatus, expiryToneClass } from './agreement-expiry'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  open: boolean
  entity: EntityRef
  nda: Agreement
  onClose: () => void
}

export function AgreementExtendModal({ open, entity, nda, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const mutation = useExtendAgreement(entity)
  const [days, setDays] = useState<number>(nda.expiryDays || 30)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset to the agreement's stored window each time the modal opens — avoids
  // stale state from a prior open.
  useEffect(() => {
    if (open) setDays(nda.expiryDays || 30)
  }, [open, nda.expiryDays])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, mutation.isPending, onClose])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const expiry = getExpiryStatus(nda, i18n.language)
  const valid =
    Number.isInteger(days) && days >= EXPIRY_DAYS_MIN && days <= EXPIRY_DAYS_MAX
  const canApply = valid && !mutation.isPending

  const handleApply = () => {
    if (!canApply) return
    mutation.mutate(
      { agreementId: nda.id, days },
      { onSuccess: () => onClose() },
    )
  }

  const handleClose = () => {
    if (mutation.isPending) return
    onClose()
  }

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[10010]" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-extend-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10011] w-full max-w-md bg-card border border-border rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 id="agreement-extend-title" className="text-base font-semibold text-foreground">
            {t('agreements.extend.title')}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            aria-label={t('common.close')}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {expiry.kind !== 'na' && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
              <div className={'flex items-center gap-1.5 ' + expiryToneClass(expiry.kind)}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">{expiry.label}</span>
              </div>
              {expiry.fullDate && (
                <div className="text-muted-foreground mt-0.5">{expiry.fullDate}</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('agreements.extend.daysLabel')}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={EXPIRY_DAYS_MIN}
                max={EXPIRY_DAYS_MAX}
                step={1}
                value={days}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setDays(Number.isFinite(n) ? n : 0)
                }}
                disabled={mutation.isPending}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-sm text-muted-foreground">
                {t('agreements.extend.daysUnit')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {EXPIRY_DAYS_PRESETS.map((p) => {
                const active = days === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDays(p)}
                    disabled={mutation.isPending}
                    className={
                      'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ' +
                      (active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted text-muted-foreground')
                    }
                  >
                    {p}d
                  </button>
                )
              })}
            </div>
            {!valid && (
              <p className="text-xs text-destructive mt-1.5">
                {t('agreements.wizard.fields.expiryDaysInvalid', {
                  min: EXPIRY_DAYS_MIN,
                  max: EXPIRY_DAYS_MAX,
                })}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {t('agreements.extend.hint')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('agreements.extend.applyCta')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
