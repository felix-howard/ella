/**
 * Lead List Pagination - Simple prev/next pager for the leads table.
 */
import { useTranslation } from 'react-i18next'

interface LeadListPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function LeadListPagination({ page, totalPages, onPageChange }: LeadListPaginationProps) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
      >
        {t('common.previous')}
      </button>
      <span className="text-sm text-muted-foreground">
        {t('leads.pageOf', { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
      >
        {t('common.next')}
      </button>
    </div>
  )
}
