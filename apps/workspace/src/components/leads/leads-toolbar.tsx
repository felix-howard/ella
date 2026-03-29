/**
 * Leads Toolbar - Search, filter, and bulk actions
 */
import { useTranslation } from 'react-i18next'
import { Search, MessageSquare } from 'lucide-react'
import type { LeadStatus } from '../../lib/api-client'

interface LeadsToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: LeadStatus | ''
  onStatusFilterChange: (status: LeadStatus | '') => void
  selectedCount: number
  onBulkSms: () => void
}

const STATUSES: (LeadStatus | '')[] = ['', 'NEW', 'CONTACTED', 'CONVERTED', 'LOST']

export function LeadsToolbar({
  search, onSearchChange, statusFilter, onStatusFilterChange, selectedCount, onBulkSms,
}: LeadsToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('leads.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as LeadStatus | '')}
        className="px-3 py-2 rounded-lg border border-border bg-card text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {STATUSES.map((status) => (
          <option key={status || 'all'} value={status}>
            {status ? t(`leads.status.${status}`) : t('leads.allStatuses')}
          </option>
        ))}
      </select>

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
