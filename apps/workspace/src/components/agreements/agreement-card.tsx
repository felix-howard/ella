/**
 * Interactive entity-scoped Agreement row: wraps the shared <NdaReadonlyCard />
 * for presentation (title, type, status badges, metadata) and adds the actions:
 * copy link, resend SMS, view PDF, deposit update. Branches PDF endpoint by
 * entity type. Deposit update is hidden when the agreement carries no deposit.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, RefreshCw, FileText, Loader2, Pencil, Clock } from 'lucide-react'
import { useResendAgreement, agreementsApi } from './use-agreement-mutations'
import { UpdateDepositPanel } from './update-deposit-panel'
import { NdaReadonlyCard } from './agreement-readonly-card'
import { AgreementExtendModal } from './agreement-extend-modal'
import { getExpiryStatus } from './agreement-expiry'
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
  const { t, i18n } = useTranslation()
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const resendMutation = useResendAgreement(entity, nda.type)

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
  // Extend is only meaningful while the link is still the source of truth.
  // Allow it both when active and when expired (lets staff resurrect a link
  // without rotating the token + spamming SMS via Resend).
  const canExtend =
    nda.status !== 'SIGNED' && nda.status !== 'VOIDED' && !!nda.expiresAt
  // Hide deposit editor for agreements that opted out of deposit at send time.
  const canEditDeposit = nda.depositStatus !== null

  // Soon/expired states promote Extend to a primary visual treatment so it
  // grabs the staff member's attention on the busiest cards.
  const expiryKind = getExpiryStatus(nda, i18n.language).kind
  const extendIsUrgent = expiryKind === 'soon' || expiryKind === 'expired'

  // View PDF rendered here (not via shared card) so it lines up with the
  // other entity-page actions on a single flex row.
  const hasActions = canCopyOrResend || canExtend || canViewPdf || canEditDeposit

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-border">
      <NdaReadonlyCard nda={nda} framed={false} />

      {hasActions && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {canCopyOrResend && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70"
              >
                <Copy className="w-3.5 h-3.5" />
                {t('nda.card.copyLink')}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendMutation.isPending}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
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
          {canExtend && (
            <button
              type="button"
              onClick={() => setExtendOpen(true)}
              className={
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ' +
                (extendIsUrgent
                  ? 'border border-primary bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border border-border hover:bg-muted/70')
              }
            >
              <Clock className="w-3.5 h-3.5" />
              {t('nda.card.extend')}
            </button>
          )}
          {canViewPdf && (
            <button
              type="button"
              onClick={handleViewPdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-50"
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
              onClick={() => setDepositModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('nda.card.updateDeposit')}
            </button>
          )}
        </div>
      )}

      {/* Type-narrow nda for the modal: canEditDeposit guarantees depositStatus is non-null. */}
      {depositModalOpen && canEditDeposit && nda.depositStatus !== null && (
        <UpdateDepositPanel
          entity={entity}
          nda={{ ...nda, depositStatus: nda.depositStatus }}
          onClose={() => setDepositModalOpen(false)}
        />
      )}

      <AgreementExtendModal
        open={extendOpen}
        entity={entity}
        nda={nda}
        onClose={() => setExtendOpen(false)}
      />
    </div>
  )
}
