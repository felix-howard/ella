import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SelectAllFilteredBannerProps {
  pageSelectedCount: number
  selectedCount: number
  selectableTotal: number
  bulkSmsLimit: number
  allFilteredSelected: boolean
  isFetchingTargets: boolean
  error?: string | null
  onSelectAllFiltered: () => void
}

export function SelectAllFilteredBanner({
  pageSelectedCount,
  selectedCount,
  selectableTotal,
  bulkSmsLimit,
  allFilteredSelected,
  isFetchingTargets,
  error,
  onSelectAllFiltered,
}: SelectAllFilteredBannerProps) {
  const { t } = useTranslation()
  const overLimit = selectableTotal > bulkSmsLimit

  if (selectableTotal <= pageSelectedCount && !allFilteredSelected) return null

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 border-b border-border/50 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2">
        {overLimit ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" aria-hidden="true" />
        ) : allFilteredSelected ? (
          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
        ) : null}
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {allFilteredSelected
              ? t('leads.allFilteredSelected', { count: selectedCount })
              : t('leads.selectedOnPage', { count: pageSelectedCount })}
          </p>
          <p className="text-muted-foreground">
            {overLimit
              ? t('leads.bulkSmsOverLimit', { count: selectableTotal, limit: bulkSmsLimit })
              : t('leads.bulkSmsLimitHint', { limit: bulkSmsLimit })}
          </p>
          {error && <p className="mt-1 text-red-600">{error}</p>}
        </div>
      </div>

      {!allFilteredSelected && !overLimit && (
        <button
          type="button"
          onClick={onSelectAllFiltered}
          disabled={isFetchingTargets}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {isFetchingTargets && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isFetchingTargets
            ? t('leads.selectingTargets')
            : t('leads.selectAllFiltered', { count: selectableTotal })}
        </button>
      )}
    </div>
  )
}
