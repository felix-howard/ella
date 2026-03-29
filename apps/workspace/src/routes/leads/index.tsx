/**
 * Leads List Page - View leads with search, filter, multi-select, and convert
 */
import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Users } from 'lucide-react'
import { PageContainer } from '../../components/layout'
import { LeadsToolbar } from '../../components/leads/leads-toolbar'
import { LeadCard } from '../../components/leads/lead-card'
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

  const leads: Lead[] = data?.data ?? []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const selectableLeads = useMemo(
    () => leads.filter((l) => l.status !== 'CONVERTED'),
    [leads]
  )

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      selected ? next.add(id) : next.delete(id)
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

  const newCount = leads.filter((l) => l.status === 'NEW').length

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{t('leads.title')}</h1>
        {newCount > 0 && (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
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

      {/* Select All */}
      {selectableLeads.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={selectedIds.size === selectableLeads.length && selectableLeads.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? t('leads.selected', { count: selectedIds.size })
              : t('leads.selectAll')}
          </span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {!isLoading && leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">{t('leads.noLeads')}</h3>
          <p className="text-sm text-muted-foreground">{t('leads.noLeadsDesc')}</p>
        </div>
      )}

      {!isLoading && leads.length > 0 && (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selectedIds.has(lead.id)}
              onSelect={handleSelect}
              onConvert={setConvertLead}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="text-sm text-muted-foreground">
            {t('leads.pageOf', { current: page, total: totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}

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
