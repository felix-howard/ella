/**
 * Leads List Page - Table view with search, filter, multi-select, and convert
 */
import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { LeadsToolbar } from '../../components/leads/leads-toolbar'
import { LeadListTable } from '../../components/leads/lead-list-table'
import { LeadDetailDrawer } from '../../components/leads/lead-detail-drawer'
import { ConvertLeadDialog } from '../../components/leads/convert-lead-dialog'
import { BulkSmsDialog } from '../../components/leads/bulk-sms-dialog'
import { CampaignsTab } from '../../components/leads/campaigns-tab'
import { api } from '../../lib/api-client'
import type { Lead, LeadStatus } from '../../lib/api-client'
import { useDebouncedValue } from '../../hooks'

export const Route = createFileRoute('/leads/')({
  component: LeadsPage,
})

function LeadsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'leads' | 'campaigns'>('leads')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [showBulkSms, setShowBulkSms] = useState(false)
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebouncedValue(search, 300)

  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, debouncedSearch, statusFilter, tagFilter],
    queryFn: () => api.leads.list({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      tag: tagFilter || undefined,
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

  const handleTagChange = (tag: string) => {
    setTagFilter(tag)
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

  const handleViewCampaignLeads = useCallback((tag: string) => {
    setTagFilter(tag)
    setPage(1)
    setSelectedIds(new Set())
    setActiveTab('leads')
  }, [])

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-foreground">{t('leads.title')}</h1>
        {activeTab === 'leads' && newCount > 0 && (
          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            {t('leads.newCount', { count: newCount })}
          </span>
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
              : 'border-transparent text-muted-foreground hover:text-foreground'
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
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('leads.campaigns')}
        </button>
      </div>

      {activeTab === 'leads' ? (
        <>
          <LeadsToolbar
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusChange}
            tagFilter={tagFilter}
            onTagFilterChange={handleTagChange}
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
