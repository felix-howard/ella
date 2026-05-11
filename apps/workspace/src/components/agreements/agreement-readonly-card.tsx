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
import {
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock,
  FileText,
  Loader2,
  StickyNote,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { NdaStatusBadge, DepositStatusBadge, AgreementTypeBadge } from './agreement-status-badges'
import { toast } from '../../stores/toast-store'
import { formatShortRelativeTime, formatFullDateTime } from '../../lib/formatters'
import { agreementsApi } from './use-agreement-mutations'
import { getExpiryStatus, expiryToneClass } from './agreement-expiry'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  /** Renamed from `nda` — accepts any agreement type. */
  nda: Agreement
  /** Entity owning this agreement (lead or client). When provided + showViewPdf, exposes "View PDF". */
  entity?: EntityRef
  /** Render the View PDF button when the agreement is SIGNED with a stored PDF. */
  showViewPdf?: boolean
  /** Set false when another component owns the card chrome and action footer. */
  framed?: boolean
}

export function NdaReadonlyCard({ nda, entity, showViewPdf = false, framed = true }: Props) {
  const { t, i18n } = useTranslation()
  const [pdfLoading, setPdfLoading] = useState(false)

  const canViewPdf = showViewPdf && !!entity && nda.status === 'SIGNED' && !!nda.signedPdfKey
  const typeLabel = t(`agreements.type.${nda.type}`)
  const titleRepeatsType = nda.title.trim().toLowerCase() === typeLabel.trim().toLowerCase()

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
    <div
      className={cn(
        'space-y-3',
        framed && 'rounded-xl border border-border/60 bg-card p-4 shadow-sm'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold leading-snug text-foreground break-words">
            {nda.title}
          </h4>
          {!titleRepeatsType && (
            <div className="mt-1">
              <AgreementTypeBadge type={nda.type} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <NdaStatusBadge status={nda.status} />
          {nda.depositStatus && <DepositStatusBadge status={nda.depositStatus} />}
        </div>
      </div>

      {(() => {
        const expiry = getExpiryStatus(nda, i18n.language)
        return (
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-muted-foreground/80" />
              <span className="shrink-0 font-medium">{t('nda.card.created')}</span>
              <span className="truncate text-foreground">
                {formatShortRelativeTime(nda.createdAt, i18n.language)}
              </span>
            </div>
            {expiry.kind !== 'na' && (
              <div
                className={'flex items-center gap-2 min-w-0 ' + expiryToneClass(expiry.kind)}
                title={expiry.fullDate ?? undefined}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{expiry.label}</span>
                {expiry.fullDate && (
                  <span className="hidden truncate text-muted-foreground sm:inline">
                    {expiry.fullDate}
                  </span>
                )}
              </div>
            )}
            {nda.signedAt && (
              <div className="flex items-center gap-2 min-w-0">
                <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span className="shrink-0 font-medium">{t('nda.card.signed')}</span>
                <span className="truncate text-foreground">{formatFullDateTime(nda.signedAt)}</span>
              </div>
            )}
            {nda.depositPaidAt && (
              <div className="flex items-center gap-2 min-w-0">
                <CircleDollarSign className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span className="shrink-0 font-medium">{t('nda.card.depositPaid')}</span>
                <span className="truncate text-foreground">
                  {formatFullDateTime(nda.depositPaidAt)}
                </span>
              </div>
            )}
            {nda.depositNote && (
              <div className="flex items-start gap-2 min-w-0 rounded-lg bg-muted/30 px-2.5 py-2 text-foreground sm:col-span-2 xl:col-span-3">
                <StickyNote className="mt-0.5 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 whitespace-pre-wrap break-words">
                  <span className="font-medium text-muted-foreground">
                    {t('nda.deposit.noteLabel')}:
                  </span>{' '}
                  {nda.depositNote}
                </div>
              </div>
            )}
          </div>
        )
      })()}

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
