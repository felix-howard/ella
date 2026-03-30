/**
 * Leads List Page - Table view with search, filter, multi-select, and convert
 */
import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../../components/layout'
import { LeadsToolbar } from '../../components/leads/leads-toolbar'
import { LeadListTable } from '../../components/leads/lead-list-table'
import { LeadDetailDrawer } from '../../components/leads/lead-detail-drawer'
import { ConvertLeadDialog } from '../../components/leads/convert-lead-dialog'
import { BulkSmsDialog } from '../../components/leads/bulk-sms-dialog'
import { api } from '../../lib/api-client'
import type { Lead, LeadStatus } from '../../lib/api-client'
import { useDebouncedValue } from '../../hooks'

export const Route = createFileRoute('/leads/')({
  component: LeadsPage,
})

function LeadsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [showBulkSms, setShowBulkSms] = useState(false)
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebouncedValue(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, debouncedSearch, statusFilter],
    queryFn: () => api.leads.list({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const leads = useMemo(
    () => data?.data ?? [],
    [data?.data]
  )
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const selectableLeads = useMemo(
    () => leads.filter((l) => l.status !== 'CONVERTED'),
    [leads]
  )

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedIds(selected ? new Set(selectableLeads.map((l) => l.id)) : new Set())
  }, [selectableLeads])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
    setSelectedIds(new Set())
  }

  const handleStatusChange = (status: LeadStatus | '') => {
    setStatusFilter(status)
    setPage(1)
    setSelectedIds(new Set())
  }

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead)
  }

  const newCount = useMemo(() => leads.filter((l) => l.status === 'NEW').length, [leads])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    setSelectedIds(new Set())
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{t('leads.title')}</h1>
        {newCount > 0 && (
          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            {t('leads.newCount', { count: newCount })}
          </span>
        )}
      </div>

      <LeadsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusChange}
        selectedCount={selectedIds.size}
        onBulkSms={() => setShowBulkSms(true)}
      />

      <LeadListTable
        leads={leads}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onConvert={setConvertLead}
        onRowClick={handleRowClick}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="text-sm text-muted-foreground">
            {t('leads.pageOf', { current: page, total: totalPages })}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}

      <LeadDetailDrawer
        lead={selectedLead}
        open={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        onConvert={(lead) => { setSelectedLead(null); setConvertLead(lead) }}
      />

      {convertLead && (
        <ConvertLeadDialog lead={convertLead} onClose={() => setConvertLead(null)} />
      )}

      {showBulkSms && (
        <BulkSmsDialog
          leads={leads.filter((l) => selectedIds.has(l.id))}
          onClose={() => { setShowBulkSms(false); setSelectedIds(new Set()) }}
        />
      )}
    </PageContainer>
  )
}
