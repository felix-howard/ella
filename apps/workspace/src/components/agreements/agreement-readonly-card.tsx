/**
 * Shared, presentation-only NDA card. Used by:
 *   - Lead detail page (wrapped by NdaCard which adds interactive buttons)
 *   - Client Overview tab (read-only — exposes "View PDF" only)
 *   - Client Agreements tab (wrapped by NdaCard for interactive actions)
 *
 * Owns no mutations. Renders status badges, metadata, deposit info, and an
 * optional "View PDF" action that opens the signed PDF presigned URL via the
 * entity-aware `getPdfUrl` endpoint (lead vs. client).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2 } from 'lucide-react'
import { NdaStatusBadge, DepositStatusBadge, AgreementTypeBadge } from './agreement-status-badges'
import { toast } from '../../stores/toast-store'
import { formatShortRelativeTime, formatFullDateTime } from '../../lib/formatters'
import { agreementsApi } from './use-agreement-mutations'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  /** Renamed from `nda` — accepts any agreement type. */
  nda: Agreement
  /** Entity owning this agreement (lead or client). When provided + showViewPdf, exposes "View PDF". */
  entity?: EntityRef
  /** Render the View PDF button when the agreement is SIGNED with a stored PDF. */
  showViewPdf?: boolean
}

export function NdaReadonlyCard({ nda, entity, showViewPdf = false }: Props) {
  const { t, i18n } = useTranslation()
  const [pdfLoading, setPdfLoading] = useState(false)

  const canViewPdf = showViewPdf && !!entity && nda.status === 'SIGNED' && !!nda.signedPdfKey

  const handleViewPdf = async () => {
    if (!entity) return
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

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground break-words">
            {nda.title}
          </h4>
        </div>
        <AgreementTypeBadge type={nda.type} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NdaStatusBadge status={nda.status} />
        {nda.depositStatus && <DepositStatusBadge status={nda.depositStatus} />}
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>
          {t('nda.card.created')}:{' '}
          <span className="text-foreground">
            {formatShortRelativeTime(nda.createdAt, i18n.language)}
          </span>
        </div>
        {nda.signedAt && (
          <div>
            {t('nda.card.signed')}:{' '}
            <span className="text-foreground">{formatFullDateTime(nda.signedAt)}</span>
          </div>
        )}
        {nda.depositPaidAt && (
          <div>
            {t('nda.card.depositPaid')}:{' '}
            <span className="text-foreground">{formatFullDateTime(nda.depositPaidAt)}</span>
          </div>
        )}
        {nda.depositNote && (
          <div className="mt-1 p-2 rounded bg-muted/30 text-foreground whitespace-pre-wrap break-words">
            {nda.depositNote}
          </div>
        )}
      </div>

      {canViewPdf && (
        <div className="flex flex-wrap gap-2">
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
        </div>
      )}
    </div>
  )
}
