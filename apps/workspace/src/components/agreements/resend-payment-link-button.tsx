/**
 * "Resend payment link" action for an agreement card. Visible only when the
 * agreement is SIGNED with a PENDING deposit on a Client entity (the staff
 * resend endpoint is client-scoped). Re-sends the portal pay-link SMS, then
 * disables itself for 60s to prevent accidental SMS spam.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Send } from 'lucide-react'
import { api, type Agreement } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { EntityRef } from './types'

const RESEND_COOLDOWN_MS = 60_000

interface Props {
  entity: EntityRef
  nda: Agreement
}

export function ResendPaymentLinkButton({ entity, nda }: Props) {
  const { t } = useTranslation()
  const [cooldown, setCooldown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const mutation = useMutation({
    mutationFn: () => api.clients.agreements.resendPaymentLink(entity.id, nda.id),
    onSuccess: () => {
      toast.success(t('payments.resendSuccess'))
      setCooldown(true)
      timerRef.current = setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS)
    },
    onError: (err) => {
      toast.error((err as Error).message || t('payments.resendError'))
    },
  })

  // Endpoint exists for clients only; deposit must still be awaiting payment.
  if (entity.type !== 'client' || nda.status !== 'SIGNED' || nda.depositStatus !== 'PENDING') {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || cooldown}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
    >
      {mutation.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Send className="w-3.5 h-3.5" />
      )}
      {cooldown ? t('payments.resendSent') : t('payments.resendPaymentLink')}
    </button>
  )
}
