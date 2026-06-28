/**
 * Confirmation dialog for revoking unsigned agreements. Revocation keeps the
 * agreement row for audit history but disables the old public signing link.
 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Ban, Loader2, X } from 'lucide-react'
import { useVoidAgreement } from './use-agreement-mutations'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

export const VOID_REASON_MAX_LENGTH = 500
export const VOID_REASON_MIN_LENGTH = 3

export function normalizeVoidAgreementReason(value: string): string {
  return value.trim()
}

export function isVoidAgreementReasonValid(value: string): boolean {
  const reason = normalizeVoidAgreementReason(value)
  return reason.length >= VOID_REASON_MIN_LENGTH && reason.length <= VOID_REASON_MAX_LENGTH
}

interface Props {
  open: boolean
  entity: EntityRef
  nda: Agreement
  onClose: () => void
}

export function AgreementVoidModal({ open, entity, nda, onClose }: Props) {
  if (!open) return null
  return (
    <AgreementVoidModalContent
      key={nda.id}
      entity={entity}
      nda={nda}
      onClose={onClose}
    />
  )
}

function AgreementVoidModalContent({
  entity,
  nda,
  onClose,
}: Omit<Props, 'open'>) {
  const { t } = useTranslation()
  const mutation = useVoidAgreement(entity)
  const [reason, setReason] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [mutation.isPending, onClose])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const trimmedReason = normalizeVoidAgreementReason(reason)
  const reasonInvalid = !isVoidAgreementReasonValid(reason)
  const showReasonError =
    attemptedSubmit || (reason.length > 0 && reasonInvalid)
  const canSubmit = !reasonInvalid && !mutation.isPending

  const handleClose = () => {
    if (mutation.isPending) return
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAttemptedSubmit(true)
    if (!canSubmit) return

    mutation.mutate(
      { agreementId: nda.id, reason: trimmedReason },
      { onSuccess: () => onClose() },
    )
  }

  const descriptionId = 'agreement-void-description'
  const reasonErrorId = 'agreement-void-reason-error'

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[10010]" onClick={handleClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-void-title"
        aria-describedby={descriptionId}
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-[10011] flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="agreement-void-title" className="text-base font-semibold text-foreground">
            {t('agreements.void.title')}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            aria-label={t('common.close')}
            className="rounded-md p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {t('agreements.void.description')}
          </p>

          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="flex gap-2">
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('agreements.void.warning')}</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t('agreements.void.agreementLabel')}
            </div>
            <div className="mt-0.5 break-words text-sm font-medium text-foreground">
              {nda.title}
            </div>
          </div>

          <div>
            <label
              htmlFor="agreement-void-reason"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {t('agreements.void.reasonLabel')}
            </label>
            <textarea
              ref={textareaRef}
              id="agreement-void-reason"
              value={reason}
              maxLength={VOID_REASON_MAX_LENGTH}
              rows={4}
              disabled={mutation.isPending}
              aria-describedby={showReasonError ? reasonErrorId : undefined}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('agreements.void.reasonPlaceholder')}
              className="min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-xs">
              {showReasonError ? (
                <p id={reasonErrorId} className="text-destructive">
                  {t('agreements.void.reasonRequired')}
                </p>
              ) : (
                <p className="text-muted-foreground">{t('agreements.void.reasonHint')}</p>
              )}
              <span className="shrink-0 text-muted-foreground">
                {reason.length}/{VOID_REASON_MAX_LENGTH}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('agreements.void.confirmCta')}
          </button>
        </div>
      </form>
    </>,
    document.body,
  )
}
