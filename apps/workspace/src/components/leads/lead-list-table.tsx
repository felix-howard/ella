/**
 * Lead List Table - Polished table shell with sticky header and row polish.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LeadListRow } from './lead-list-row'
import { LeadListTableSkeleton } from './lead-list-table-skeleton'
import { LeadListEmptyState } from './lead-list-empty-state'
import { SelectAllFilteredBanner } from './select-all-filtered-banner'
import type { Lead } from '../../lib/api-client'

export { LeadListTableSkeleton }

interface LeadListTableProps {
  leads: Lead[]
  selectedIds: Set<string>
  selectionMode: 'explicit' | 'filtered'
  selectableTotal: number
  bulkSmsLimit: number
  isFetchingTargets: boolean
  targetPreviewError?: string | null
  selectionDisabled?: boolean
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onSelectAllFiltered: () => void
  onRowClick: (lead: Lead) => void
  isLoading?: boolean
  hasActiveFilters?: boolean
  onAddLead?: () => void
  onClearFilters?: () => void
}

export function LeadListTable({
  leads, selectedIds, selectionMode, selectableTotal, bulkSmsLimit,
  isFetchingTargets, targetPreviewError, selectionDisabled = false, onSelect, onSelectAll,
  onSelectAllFiltered, onRowClick, isLoading,
  hasActiveFilters, onAddLead, onClearFilters,
}: LeadListTableProps) {
  const { t } = useTranslation()
  const selectPageRef = useRef<HTMLInputElement>(null)
  const selectablePageLeads = leads.filter((l) => l.status !== 'CONVERTED')
  const pageSelectedCount = selectablePageLeads.filter((l) => selectedIds.has(l.id)).length
  const allSelected = selectablePageLeads.length > 0 && pageSelectedCount === selectablePageLeads.length
  const someSelected = pageSelectedCount > 0 && !allSelected
  const allFilteredSelected = selectionMode === 'filtered' &&
    selectedIds.size === selectableTotal &&
    selectableTotal > 0
  const showFilteredBanner = allSelected && selectableTotal > selectablePageLeads.length

  useEffect(() => {
    if (selectPageRef.current) selectPageRef.current.indeterminate = someSelected
  }, [someSelected])

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

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-visible">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-border/50 bg-muted/50 backdrop-blur-sm">
              <th className="px-4 py-3 w-10">
                <label className="relative flex items-center cursor-pointer">
                  <input
                    ref={selectPageRef}
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectablePageLeads.length === 0 || selectionDisabled}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="peer sr-only"
                    aria-label={t('leads.selectPage')}
                  />
                  <div className="h-4 w-4 rounded border-2 border-muted-foreground/40 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors flex items-center justify-center">
                    {allSelected ? (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : someSelected && (
                      <span className="h-0.5 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
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
            {showFilteredBanner && (
              <tr>
                <td colSpan={7} className="p-0">
                  <SelectAllFilteredBanner
                    pageSelectedCount={pageSelectedCount}
                    selectedCount={selectedIds.size}
                    selectableTotal={selectableTotal}
                    bulkSmsLimit={bulkSmsLimit}
                    allFilteredSelected={allFilteredSelected}
                    isFetchingTargets={isFetchingTargets}
                    error={targetPreviewError}
                    onSelectAllFiltered={onSelectAllFiltered}
                  />
                </td>
              </tr>
            )}
            {leads.map((lead, index) => (
              <LeadListRow
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onSelect={onSelect}
                onRowClick={onRowClick}
                selectionDisabled={selectionDisabled}
                isLast={index === leads.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
