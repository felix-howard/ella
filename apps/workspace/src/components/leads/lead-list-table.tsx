/**
 * Lead List Table - Polished table shell with sticky header and row polish.
 */
import { useTranslation } from 'react-i18next'
import { LeadListRow } from './lead-list-row'
import { LeadListTableSkeleton } from './lead-list-table-skeleton'
import { LeadListEmptyState } from './lead-list-empty-state'
import type { Lead } from '../../lib/api-client'

export { LeadListTableSkeleton }

interface LeadListTableProps {
  leads: Lead[]
  selectedIds: Set<string>
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onRowClick: (lead: Lead) => void
  isLoading?: boolean
  hasActiveFilters?: boolean
  onAddLead?: () => void
  onClearFilters?: () => void
}

export function LeadListTable({
  leads, selectedIds, onSelect, onSelectAll, onRowClick, isLoading,
  hasActiveFilters, onAddLead, onClearFilters,
}: LeadListTableProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <LeadListTableSkeleton />
  }

  if (leads.length === 0) {
    return (
      <LeadListEmptyState
        variant={hasActiveFilters ? 'filtered' : 'empty'}
        onAddLead={onAddLead}
        onClearFilters={onClearFilters}
      />
    )
  }

  const allSelected = leads.length > 0 &&
    leads.filter((l) => l.status !== 'CONVERTED').every((l) => selectedIds.has(l.id))

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-border/40 bg-muted/40 backdrop-blur-sm">
              <th className="px-4 py-3 w-10">
                <label className="relative flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="peer sr-only"
                    aria-label={t('leads.selectAll')}
                  />
                  <div className="h-4 w-4 rounded border-2 border-muted-foreground/40 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors flex items-center justify-center">
                    {allSelected && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </label>
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">{t('leads.name')}</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">{t('leads.phone')}</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">{t('leads.statusLabel')}</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">{t('leads.tags')}</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">{t('leads.business')}</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">{t('leads.created')}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => (
              <LeadListRow
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onSelect={onSelect}
                onRowClick={onRowClick}
                isLast={index === leads.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
