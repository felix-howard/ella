/**
 * Leads Toolbar - Search + integrated filter pills
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { api } from '../../lib/api-client'
import type { LeadStatus } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

interface LeadsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: LeadStatus | ''
  onStatusFilterChange: (status: LeadStatus | '') => void
  tagFilter: string
  onTagFilterChange: (tag: string) => void
}

const STATUSES: LeadStatus[] = ['NEW', 'SENT', 'CONTACTED', 'CONVERTED', 'LOST']

export function LeadsToolbar({
  search, onSearchChange, statusFilter, onStatusFilterChange,
  tagFilter, onTagFilterChange,
}: LeadsToolbarProps) {
  const { t } = useTranslation()

  const { data: tagsData } = useQuery({
    queryKey: ['lead-tags'],
    queryFn: () => api.leads.tags(),
    staleTime: 60_000,
  })

  const tags = tagsData?.data ?? []
  const hasFilters = Boolean(statusFilter || tagFilter || search)

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('leads.searchPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 rounded-full bg-card border border-border/60 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('common.clear', 'Clear')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <CustomSelect
          value={statusFilter}
          onChange={(val) => onStatusFilterChange(val as LeadStatus | '')}
          options={STATUSES.map((status) => ({
            value: status,
            label: t(`leads.status.${status}`),
          }))}
          placeholder={t('leads.allStatuses')}
          className="w-36"
        />

        {tags.length > 0 && (
          <CustomSelect
            value={tagFilter}
            onChange={onTagFilterChange}
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            placeholder={t('leads.allTags')}
            className="w-36"
          />
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('')
              onStatusFilterChange('')
              onTagFilterChange('')
            }}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t('leads.clearFilters', 'Clear')}
          </button>
        )}
      </div>
    </div>
  )
}
