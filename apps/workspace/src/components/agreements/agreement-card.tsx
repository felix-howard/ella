/**
 * Interactive entity-scoped Agreement row: wraps the shared <NdaReadonlyCard />
 * for presentation (title, type, status badges, metadata) and adds the actions:
 * copy link, resend SMS, view PDF, deposit update. Branches PDF endpoint by
 * entity type. Deposit update is hidden when the agreement carries no deposit.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw, FileText, Loader2, Pencil } from 'lucide-react'
import { useResendAgreement, agreementsApi } from './use-agreement-mutations'
import { UpdateDepositPanel } from './update-deposit-panel'
import { NdaReadonlyCard } from './agreement-readonly-card'
import { toast } from '../../stores/toast-store'
import { copyToClipboard } from '../../lib/clipboard'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  entity: EntityRef
  /** Prop name kept as `nda` for parent compatibility — accepts any agreement type. */
  nda: Agreement
}

export function NdaCard({ entity, nda }: Props) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const resendMutation = useResendAgreement(entity)

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
      const res = await agreementsApi(entity).getPdfUrl(entity.id, nda.id)
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error((err as Error).message || t('nda.toast.pdfFailed'))
    } finally {
      setPdfLoading(false)
    }
  }

  const canCopyOrResend = nda.status === 'SENT' && nda.isActive
  const canViewPdf = nda.status === 'SIGNED' && !!nda.signedPdfKey
  // Hide deposit editor for agreements that opted out of deposit at send time.
  const canEditDeposit = nda.depositStatus !== null

  // View PDF rendered here (not via shared card) so it lines up with the
  // other entity-page actions on a single flex row.
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
        {canEditDeposit && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            {editing ? t('nda.card.closeDeposit') : t('nda.card.updateDeposit')}
          </button>
        )}
      </div>

      {/* Type-narrow nda for the panel: canEditDeposit guarantees depositStatus is non-null. */}
      {editing && canEditDeposit && nda.depositStatus !== null && (
        <UpdateDepositPanel
          entity={entity}
          nda={{ ...nda, depositStatus: nda.depositStatus }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
