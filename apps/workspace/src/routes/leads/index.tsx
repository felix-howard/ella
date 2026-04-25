/**
 * Leads List Page - Table view with search, filter, multi-select
 */
import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { LeadListStatsBar } from '../../components/leads/lead-list-stats-bar'
import { LeadsToolbar } from '../../components/leads/leads-toolbar'
import { LeadListTable } from '../../components/leads/lead-list-table'
import { FloatingBulkBar } from '../../components/leads/floating-bulk-bar'
import { LeadListPagination } from '../../components/leads/lead-list-pagination'
import { BulkSmsDialog } from '../../components/leads/bulk-sms-dialog'
import { CampaignsTab } from '../../components/leads/campaigns-tab'
import { AddLeadModal } from '../../components/leads/add-lead-modal'
import { api } from '../../lib/api-client'
import type { Lead, LeadStatus } from '../../lib/api-client'
import { useDebouncedValue } from '../../hooks'

export const Route = createFileRoute('/leads/')({
  component: LeadsPage,
})

function LeadsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'leads' | 'campaigns'>('leads')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [tagFilter, setTagFilter] = useState('')
  const [showConverted, setShowConverted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkSms, setShowBulkSms] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebouncedValue(search, 300)

  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, debouncedSearch, statusFilter, tagFilter, showConverted],
    queryFn: () => api.leads.list({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      tag: tagFilter || undefined,
      includeConverted: showConverted || undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const leads = useMemo(() => data?.data ?? [], [data?.data])
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  const selectableLeads = useMemo(
    () => leads.filter((l) => l.status !== 'CONVERTED'),
    [leads],
  )

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter || tagFilter)

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id); else next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedIds(selected ? new Set(selectableLeads.map((l) => l.id)) : new Set())
  }, [selectableLeads])

  // Reset selection + page whenever filters mutate
  const resetPagingAndSelection = () => { setPage(1); setSelectedIds(new Set()) }

  const handleSearchChange = (value: string) => { setSearch(value); resetPagingAndSelection() }
  const handleStatusChange = (status: LeadStatus | '') => { setStatusFilter(status); resetPagingAndSelection() }
  const handleTagChange = (tag: string) => { setTagFilter(tag); resetPagingAndSelection() }
  const handleShowConvertedChange = (next: boolean) => { setShowConverted(next); resetPagingAndSelection() }
  const handleClearFilters = () => {
    setSearch(''); setStatusFilter(''); setTagFilter(''); setShowConverted(false); resetPagingAndSelection()
  }
  const handlePageChange = (newPage: number) => { setPage(newPage); setSelectedIds(new Set()) }
  const handleRowClick = (lead: Lead) => {
    navigate({ to: '/leads/$leadId', params: { leadId: lead.id } })
  }

  const handleViewCampaignLeads = useCallback((tag: string) => {
    setTagFilter(tag); setPage(1); setSelectedIds(new Set()); setActiveTab('leads')
  }, [])

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-foreground">{t('leads.title')}</h1>
        {activeTab === 'leads' && (
          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            <span>{t('leads.addLead', 'Add Lead')}</span>
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('leads')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'leads'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('leads.allLeads')}
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'campaigns'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('leads.campaigns')}
        </button>
      </div>

      {activeTab === 'leads' ? (
        <>
          <LeadListStatsBar />

          <LeadsToolbar
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusChange}
            tagFilter={tagFilter}
            onTagFilterChange={handleTagChange}
            showConverted={showConverted}
            onShowConvertedChange={handleShowConvertedChange}
          />

          <LeadListTable
            leads={leads}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onRowClick={handleRowClick}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            onAddLead={() => setShowAddLead(true)}
            onClearFilters={handleClearFilters}
          />

          {!isLoading && (
            <LeadListPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          )}

          <FloatingBulkBar
            selectedCount={selectedIds.size}
            onSendSms={() => setShowBulkSms(true)}
            onClear={() => setSelectedIds(new Set())}
          />

          {showBulkSms && (
            <BulkSmsDialog
              leads={leads.filter((l) => selectedIds.has(l.id))}
              onClose={() => { setShowBulkSms(false); setSelectedIds(new Set()) }}
            />
          )}

          <AddLeadModal
            isOpen={showAddLead}
            onClose={() => setShowAddLead(false)}
          />
        </>
      ) : (
        <CampaignsTab
          onViewLeads={handleViewCampaignLeads}
          orgSlug={orgSettings?.slug || null}
        />
      )}
    </PageContainer>
  )
}
