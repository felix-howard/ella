/**
 * Client List Page - View all clients in Kanban or List view
 * Features: view toggle, search, status filter
 */

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Search, LayoutGrid, List, RefreshCw, Filter } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { KanbanBoard, ClientListTable } from '../../components/clients'
import { useClientViewState } from '../../stores/ui-store'
import { CASE_STATUS_LABELS, UI_TEXT } from '../../lib/constants'
import type { Client, TaxCaseStatus } from '../../lib/api-client'

export const Route = createFileRoute('/clients/')({
  component: ClientListPage,
})

function ClientListPage() {
  const { viewMode, setViewMode } = useClientViewState()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaxCaseStatus | 'ALL'>('ALL')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // TODO: Replace with API call using useSuspenseQuery
  // Mock data for now
  const mockClients: Client[] = [
    {
      id: '1',
      name: 'Nguyễn Văn An',
      phone: '8182223333',
      email: 'an.nguyen@email.com',
      language: 'VI',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-12T14:30:00Z',
      taxCases: [{ status: 'WAITING_DOCS', taxYear: 2025 }],
    },
    {
      id: '2',
      name: 'Trần Thị Bình',
      phone: '6264445555',
      email: 'binh.tran@email.com',
      language: 'VI',
      createdAt: '2026-01-08T09:00:00Z',
      updatedAt: '2026-01-11T16:00:00Z',
      taxCases: [{ status: 'IN_PROGRESS', taxYear: 2025 }],
    },
    {
      id: '3',
      name: 'Lê Minh Châu',
      phone: '7147778888',
      email: null,
      language: 'VI',
      createdAt: '2026-01-05T11:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
      taxCases: [{ status: 'INTAKE', taxYear: 2025 }],
    },
    {
      id: '4',
      name: 'Phạm Quốc Dũng',
      phone: '9496667777',
      email: 'dung.pham@email.com',
      language: 'EN',
      createdAt: '2026-01-03T08:00:00Z',
      updatedAt: '2026-01-09T12:00:00Z',
      taxCases: [{ status: 'READY_FOR_ENTRY', taxYear: 2025 }],
    },
    {
      id: '5',
      name: 'Hoàng Thị Em',
      phone: '5629998888',
      email: 'em.hoang@email.com',
      language: 'VI',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-08T15:00:00Z',
      taxCases: [{ status: 'FILED', taxYear: 2025 }],
    },
    {
      id: '6',
      name: 'Võ Văn Phúc',
      phone: '4083334444',
      email: null,
      language: 'VI',
      createdAt: '2025-12-20T09:00:00Z',
      updatedAt: '2026-01-07T11:00:00Z',
      taxCases: [{ status: 'REVIEW', taxYear: 2025 }],
    },
  ]

  // Filter clients
  const filteredClients = mockClients.filter((client) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      !searchQuery ||
      client.name.toLowerCase().includes(searchLower) ||
      client.phone.includes(searchQuery)

    // Status filter
    const latestStatus = client.taxCases?.[0]?.status
    const matchesStatus = statusFilter === 'ALL' || latestStatus === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // TODO: Refetch data from API
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsRefreshing(false)
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

        <button
          onClick={() => {
            // TODO: Navigate to /clients/new when route is created
            alert('Chức năng thêm khách hàng mới sẽ được triển khai ở task 1.3.19')
          }}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          <span>{clientsText.newClient}</span>
        </button>
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
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            aria-label={UI_TEXT.actions.refresh}
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', isRefreshing && 'animate-spin')} />
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
      {viewMode === 'kanban' ? (
        <KanbanBoard clients={filteredClients} />
      ) : (
        <ClientListTable clients={filteredClients} />
      )}
    </PageContainer>
  )
}
