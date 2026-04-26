/**
 * Lead-page NDA row: wraps the shared <NdaReadonlyCard /> for presentation
 * (status badges, metadata, View PDF) and adds the lead-only interactive
 * actions: copy link, resend SMS, deposit update.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw, FileText, Loader2, Pencil } from 'lucide-react'
import { useResendNda } from './use-nda-mutations'
import { UpdateDepositPanel } from './update-deposit-panel'
import { NdaReadonlyCard } from '../../nda/nda-readonly-card'
import { toast } from '../../../stores/toast-store'
import { copyToClipboard } from '../../../lib/clipboard'
import { api } from '../../../lib/api-client'
import type { NdaAgreement } from '../../../lib/api-client'

interface Props {
  leadId: string
  nda: NdaAgreement
}

export function NdaCard({ leadId, nda }: Props) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const resendMutation = useResendNda(leadId)

  const handleCopyLink = () => {
    if (!nda.url) {
      toast.error(t('nda.toast.linkUnavailable'))
      return
    }
    void copyToClipboard(nda.url, { successMsg: t('nda.toast.linkCopied') })
  }

  const handleResend = () => {
    resendMutation.mutate(nda.id)
  }

  const handleViewPdf = async () => {
    try {
      setPdfLoading(true)
      const res = await api.leads.nda.getPdfUrl(leadId, nda.id)
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error((err as Error).message || t('nda.toast.pdfFailed'))
    } finally {
      setPdfLoading(false)
    }
  }

  const canCopyOrResend = nda.status === 'SENT' && nda.isActive
  const canViewPdf = nda.status === 'SIGNED' && !!nda.signedPdfKey

  // View PDF rendered here (not via shared card) so it lines up with the
  // other lead-page actions on a single flex row.
  return (
    <div className="space-y-2">
      <NdaReadonlyCard nda={nda} />

      <div className="flex flex-wrap gap-2">
        {canCopyOrResend && (
          <>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('nda.card.copyLink')}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {resendMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t('nda.card.resend')}
            </button>
          </>
        )}
        {canViewPdf && (
          <button
            type="button"
            onClick={handleViewPdf}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {pdfLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {t('nda.card.viewPdf')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          {editing ? t('nda.card.closeDeposit') : t('nda.card.updateDeposit')}
        </button>
      </div>

      {editing && <UpdateDepositPanel leadId={leadId} nda={nda} onClose={() => setEditing(false)} />}
    </div>
  )
}
