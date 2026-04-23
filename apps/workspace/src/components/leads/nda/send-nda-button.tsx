/**
 * "Send NDA" action button with a confirm dialog.
 * Disabled when an active engagement exists: a SENT NDA (outstanding invite) or
 * a SIGNED NDA whose deposit is still PENDING/PAID (active client engagement).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Send } from 'lucide-react'
import { useCreateNda } from './use-nda-mutations'
import { formatPhone } from '../../../lib/formatters'
import type { Lead, NdaAgreement } from '../../../lib/api-client'

interface Props {
  lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'phone'>
  ndas: NdaAgreement[]
}

function computeDisabledReason(ndas: NdaAgreement[]): 'pendingSent' | 'activeEngagement' | null {
  for (const n of ndas) {
    if (n.status === 'SENT' && n.isActive) return 'pendingSent'
    if (n.status === 'SIGNED' && (n.depositStatus === 'PENDING' || n.depositStatus === 'PAID')) {
      return 'activeEngagement'
    }
  }
  return null
}

export function SendNdaButton({ lead, ndas }: Props) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const mutation = useCreateNda(lead.id)

  const disabledReason = useMemo(() => computeDisabledReason(ndas), [ndas])
  const disabled = disabledReason !== null

  const handleConfirm = () => {
    mutation.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })
  }

  // Close confirm dialog on Esc (when not mid-request)
  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) {
        e.stopPropagation()
        setConfirmOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmOpen, mutation.isPending])

  const tooltip = disabledReason ? t(`nda.send.disabled.${disabledReason}`) : undefined
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ')

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || mutation.isPending}
        title={tooltip}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {t('nda.send.button')}
      </button>

      {confirmOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[10000]"
              onClick={() => !mutation.isPending && setConfirmOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="send-nda-title"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6"
            >
              <h3 id="send-nda-title" className="text-lg font-semibold text-foreground">
                {t('nda.send.confirmTitle')}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t('nda.send.confirmMessage', {
                  name: fullName,
                  phone: formatPhone(lead.phone),
                })}
              </p>
              <div className="flex justify-end gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={mutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={mutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('nda.send.confirmCta')}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
