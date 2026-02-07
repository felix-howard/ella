/**
 * Client List Page - View all clients in Kanban or List view
 * Features: view toggle, search, status filter, activity sort
 */

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, RefreshCw, Filter, AlertCircle, Loader2, ArrowUpDown } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { ClientListTable } from '../../components/clients'
import { useDebouncedValue } from '../../hooks'
import { CASE_STATUS_LABELS, UI_TEXT, CLIENT_SORT_OPTIONS, type ClientSortOption } from '../../lib/constants'
import { api, type TaxCaseStatus } from '../../lib/api-client'

export const Route = createFileRoute('/clients/')({
  component: ClientListPage,
})

function ClientListPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaxCaseStatus | 'ALL'>('ALL')
  const [sortBy, setSortBy] = useState<ClientSortOption>('activity')

  // Debounce search query for server-side search (300ms delay)
  const [debouncedSearch, isSearchPending] = useDebouncedValue(searchQuery, 300)

  // Fetch clients from API with server-side search, filter, and sort
  const {
    data: clientsResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['clients', {
      search: debouncedSearch || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      sort: sortBy,
    }],
    queryFn: () => api.clients.list({
      limit: 100,
      search: debouncedSearch || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      sort: sortBy,
    }),
  })

  const clients = clientsResponse?.data ?? []

  const handleRefresh = () => {
    refetch()
  }

  const { clients: clientsText } = UI_TEXT
  const statusOptions: (TaxCaseStatus | 'ALL')[] = ['ALL', 'INTAKE', 'WAITING_DOCS', 'IN_PROGRESS', 'READY_FOR_ENTRY', 'ENTRY_COMPLETE', 'REVIEW', 'FILED']

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{clientsText.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} {clientsText.count}
          </p>
        </div>

        <Link
          to="/clients/new"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          <span>{clientsText.newClient}</span>
        </Link>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          {isSearchPending ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" aria-hidden="true" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            type="text"
            placeholder={clientsText.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Filter and View Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ClientSortOption)}
              className="appearance-none pl-9 pr-8 py-2.5 rounded-lg border border-border bg-card text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              aria-label={t('clients.sortBy')}
            >
              {CLIENT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaxCaseStatus | 'ALL')}
              className="appearance-none pl-9 pr-8 py-2.5 rounded-lg border border-border bg-card text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              aria-label={t('clients.filterByStatus')}
            >
              <option value="ALL">{UI_TEXT.actions.all}</option>
              {statusOptions.slice(1).map((status) => (
                <option key={status} value={status}>
                  {CASE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            aria-label={UI_TEXT.actions.refresh}
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', isRefetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <ClientListTable clients={[]} isLoading />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('clients.errorLoadingList')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : t('common.error')}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <ClientListTable clients={clients} />
      )}
    </PageContainer>
  )
}
