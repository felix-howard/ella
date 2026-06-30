import { Copy, Loader2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '../../lib/clipboard'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'
import { getAgreementPaymentPortalView } from './agreement-payment-portal-view'
import { useSendAgreementPaymentPortal } from './use-send-agreement-payment-portal'

interface Props {
  entity: EntityRef
  nda: Agreement
}

export function SendAgreementPaymentPortalButton({ entity, nda }: Props) {
  const { t } = useTranslation()
  const view = getAgreementPaymentPortalView(nda)
  const mutation = useSendAgreementPaymentPortal(entity)
  if (!view) return null

  const payUrl = mutation.data?.payUrl ?? view.payUrl
  const hasActivatedInSession = Boolean(mutation.data?.payUrl)
  const showSend = view.canSend && !hasActivatedInSession
  const showCopy = Boolean(payUrl) && (view.canCopy || hasActivatedInSession)

  const handleSend = () => {
    mutation.mutate(nda.id)
  }

  const handleCopy = () => {
    if (!payUrl) return
    void copyToClipboard(payUrl, {
      successMsg: t('agreements.paymentPortal.linkCopied'),
    })
  }

  return (
    <>
      {showSend && (
        <button
          type="button"
          onClick={handleSend}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {view.kind === 'pending_review'
            ? t('agreements.paymentPortal.sendAction')
            : t('agreements.paymentPortal.getLinkAction')}
        </button>
      )}
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70"
        >
          <Copy className="h-3.5 w-3.5" />
          {t('agreements.paymentPortal.copyAction')}
        </button>
      )}
    </>
  )
}
