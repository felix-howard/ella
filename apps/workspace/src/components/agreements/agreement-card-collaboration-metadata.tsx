import { Ban, CircleDollarSign, Pencil, Send, UserRound } from 'lucide-react'
import { formatFullDateTime, formatShortRelativeTime } from '../../lib/formatters'
import type { Agreement, AgreementStaffSummary } from '../../lib/api-client'

interface AgreementCardCollaborationMetadataProps {
  agreement: Agreement
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function staffLabel(staff?: AgreementStaffSummary | null): string | null {
  return staff?.name?.trim() || staff?.email || null
}

function formatUsdAmount(amount: string | null): string | null {
  if (!amount) return null
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return usdFormatter.format(parsed)
}

export function AgreementCardCollaborationMetadata({
  agreement,
  language,
  t,
}: AgreementCardCollaborationMetadataProps) {
  const createdBy = staffLabel(agreement.createdBy)
  const lastEditedBy = staffLabel(agreement.lastEditedBy)
  const sentBy = staffLabel(agreement.sentBy)
  const voidedBy = staffLabel(agreement.voidedBy)
  const voidedAt = agreement.voidedAt
    ? formatShortRelativeTime(agreement.voidedAt, language)
    : null
  const plannedDeposit = agreement.status === 'DRAFT'
    ? formatUsdAmount(agreement.depositAmount)
    : null
  const updatedAt = formatShortRelativeTime(agreement.updatedAt, language)

  return (
    <>
      {createdBy && (
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="w-3.5 h-3.5 shrink-0 text-muted-foreground/80" />
          <span className="shrink-0 font-medium">
            {agreement.status === 'DRAFT'
              ? t('agreements.draft.createdBy')
              : t('agreements.metadata.createdBy')}
          </span>
          <span className="truncate text-foreground">{createdBy}</span>
        </div>
      )}
      {lastEditedBy && (
        <div className="flex items-center gap-2 min-w-0">
          <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground/80" />
          <span className="shrink-0 font-medium">{t('agreements.draft.lastEditedBy')}</span>
          <span className="truncate text-foreground">
            {t('agreements.metadata.actorWithTime', { name: lastEditedBy, time: updatedAt })}
          </span>
        </div>
      )}
      {sentBy && (
        <div className="flex items-center gap-2 min-w-0">
          <Send className="w-3.5 h-3.5 shrink-0 text-muted-foreground/80" />
          <span className="shrink-0 font-medium">{t('agreements.metadata.sentBy')}</span>
          <span className="truncate text-foreground">{sentBy}</span>
        </div>
      )}
      {voidedAt && (
        <div
          className="flex items-center gap-2 min-w-0 text-destructive"
          title={agreement.voidedAt ? formatFullDateTime(agreement.voidedAt) : undefined}
        >
          <Ban className="w-3.5 h-3.5 shrink-0" />
          <span className="shrink-0 font-medium">{t('agreements.metadata.revoked')}</span>
          <span className="truncate">
            {voidedBy
              ? t('agreements.metadata.actorWithTime', { name: voidedBy, time: voidedAt })
              : voidedAt}
          </span>
        </div>
      )}
      {plannedDeposit && (
        <div className="flex items-center gap-2 min-w-0">
          <CircleDollarSign className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span className="shrink-0 font-medium">
            {t('agreements.draft.plannedDeposit')}
          </span>
          <span className="truncate text-foreground">{plannedDeposit}</span>
        </div>
      )}
      {agreement.voidReason && (
        <div className="flex items-start gap-2 min-w-0 rounded-lg bg-destructive/10 px-2.5 py-2 text-destructive sm:col-span-2 xl:col-span-3">
          <Ban className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <div className="min-w-0 whitespace-pre-wrap break-words">
            <span className="font-medium">{t('agreements.metadata.revocationReason')}:</span>{' '}
            {agreement.voidReason}
          </div>
        </div>
      )}
    </>
  )
}
