/**
 * Leads Toolbar - Search, filter, and bulk actions
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, MessageSquare } from 'lucide-react'
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
  selectedCount: number
  onBulkSms: () => void
}

const STATUSES: (LeadStatus | '')[] = ['', 'NEW', 'CONTACTED', 'CONVERTED', 'LOST']

export function LeadsToolbar({
  search, onSearchChange, statusFilter, onStatusFilterChange,
  tagFilter, onTagFilterChange, selectedCount, onBulkSms,
}: LeadsToolbarProps) {
  const { t } = useTranslation()

  const { data: tagsData } = useQuery({
    queryKey: ['lead-tags'],
    queryFn: () => api.leads.tags(),
    staleTime: 60_000,
  })

  const tags = tagsData?.data ?? []

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('leads.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2 rounded-full bg-card shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <CustomSelect
        value={statusFilter}
        onChange={(val) => onStatusFilterChange(val as LeadStatus | '')}
        options={STATUSES.filter(Boolean).map((status) => ({
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

      {selectedCount > 0 && (
        <button
          onClick={onBulkSms}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {t('leads.sendSms')} ({selectedCount})
        </button>
      )}
    </div>
  )
}
