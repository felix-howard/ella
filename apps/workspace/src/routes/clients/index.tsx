/**
 * Client List Page - View all clients in Kanban or List view
 * Features: view toggle, search, status filter
 */

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, LayoutGrid, List, RefreshCw, Filter, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { KanbanBoard, ClientListTable } from '../../components/clients'
import { useClientViewState } from '../../stores/ui-store'
import { CASE_STATUS_LABELS, UI_TEXT } from '../../lib/constants'
import { api, type Client, type TaxCaseStatus } from '../../lib/api-client'

export const Route = createFileRoute('/clients/')({
  component: ClientListPage,
})

function ClientListPage() {
  const { viewMode, setViewMode } = useClientViewState()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaxCaseStatus | 'ALL'>('ALL')

  // Fetch clients from API
  const {
    data: clientsResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['clients', { status: statusFilter === 'ALL' ? undefined : statusFilter }],
    queryFn: () => api.clients.list({
      limit: 100,
      status: statusFilter === 'ALL' ? undefined : statusFilter
    }),
  })

  const clients = clientsResponse?.data ?? []

  // Filter clients by search (server-side filtering for status already handled)
  const filteredClients = clients.filter((client) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.phone.includes(searchQuery)
    )
  })

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
            {filteredClients.length} {clientsText.count}
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
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            placeholder={clientsText.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Filter and View Controls */}
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaxCaseStatus | 'ALL')}
              className="appearance-none pl-9 pr-8 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              aria-label="Lọc theo trạng thái"
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
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            aria-label={UI_TEXT.actions.refresh}
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', isRefetching && 'animate-spin')} />
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'kanban'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={clientsText.viewKanban}
              aria-pressed={viewMode === 'kanban'}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={clientsText.viewList}
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Danh sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        // Loading skeleton
        viewMode === 'kanban' ? (
          <KanbanBoard clients={[]} isLoading />
        ) : (
          <ClientListTable clients={[]} isLoading />
        )
      ) : isError ? (
        // Error state
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Không thể tải danh sách khách hàng</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Đã xảy ra lỗi'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard clients={filteredClients} />
      ) : (
        <ClientListTable clients={filteredClients} />
      )}
    </PageContainer>
  )
}
