/**
 * Action Queue Page - Lists all pending actions for staff
 * Features: Filter by type/priority, grouped sections, complete actions
 */

import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '../../components/layout'
import { ActionCard } from '../../components/actions'
import {
  Filter,
  CheckSquare,
  SortAsc,
  RefreshCw,
  Inbox,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import {
  UI_TEXT,
  ACTION_TYPE_LABELS,
  ACTION_PRIORITY_LABELS,
} from '../../lib/constants'
import { api } from '../../lib/api-client'
import type { Action, ActionType, ActionPriority } from '../../lib/api-client'

// Search params validation
type ActionSearchParams = {
  type?: ActionType
  priority?: ActionPriority
}

export const Route = createFileRoute('/actions/')({
  component: ActionsPage,
  validateSearch: (search: Record<string, unknown>): ActionSearchParams => ({
    type: search.type as ActionType | undefined,
    priority: search.priority as ActionPriority | undefined,
  }),
})

// API response type for actions grouped by priority
interface ActionsGroupedResponse {
  urgent: Action[]
  high: Action[]
  normal: Action[]
  low: Action[]
  stats: { total: number; urgent: number; high: number; normal: number; low: number }
}

function ActionsPage() {
  const queryClient = useQueryClient()
  const { type: filterType, priority: filterPriority } = useSearch({
    from: '/actions/',
  })
  const { actions: actionsText } = UI_TEXT

  // Fetch actions from API
  const {
    data: actionsData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['actions', { type: filterType, priority: filterPriority }],
    queryFn: () =>
      api.actions.list({
        type: filterType,
        priority: filterPriority,
        isCompleted: false,
      }) as Promise<ActionsGroupedResponse>,
  })

  // Complete action mutation
  const completeMutation = useMutation({
    mutationFn: (actionId: string) => api.actions.complete(actionId),
    onSuccess: () => {
      toast.success('Đã hoàn thành công việc')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    },
    onError: () => {
      toast.error('Không thể hoàn thành công việc')
    },
  })

  // Combine all actions for filtering and grouping
  const allActions: Action[] = actionsData
    ? [...actionsData.urgent, ...actionsData.high, ...actionsData.normal, ...actionsData.low]
    : []

  // Group by priority
  const groupedActions = groupActionsByPriority(allActions)

  const handleComplete = (actionId: string) => {
    completeMutation.mutate(actionId)
  }

  const handleRefresh = () => {
    refetch()
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {actionsText.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {actionsData?.stats?.total || 0} {actionsText.pendingCount}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', (isLoading || isRefetching) && 'animate-spin')} />
          <span className="hidden sm:inline">{actionsText.refresh}</span>
        </button>
      </div>

      {/* Filters */}
      <ActionFilters
        selectedType={filterType}
        selectedPriority={filterPriority}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Đang tải công việc...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Không thể tải danh sách</h3>
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
      )}

      {/* Action List */}
      {!isLoading && !isError && (
        allActions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {groupedActions.map(({ priority, actions }) => (
              <ActionGroup
                key={priority}
                priority={priority}
                actions={actions}
                onComplete={handleComplete}
              />
            ))}
          </div>
        )
      )}
    </PageContainer>
  )
}

// Filter chips component
interface ActionFiltersProps {
  selectedType?: ActionType
  selectedPriority?: ActionPriority
}

function ActionFilters({ selectedType, selectedPriority }: ActionFiltersProps) {
  const { actions: actionsText } = UI_TEXT
  const typeOptions = Object.entries(ACTION_TYPE_LABELS) as [ActionType, string][]
  const priorityOptions = Object.entries(ACTION_PRIORITY_LABELS) as [ActionPriority, string][]

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{actionsText.filterBy}</span>
      </div>

      <div className="space-y-3">
        {/* Type filter */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">{actionsText.typeFilter}</p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label={actionsText.all}
              href="/actions"
              isActive={!selectedType}
            />
            {typeOptions.map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                href={`/actions?type=${value}${selectedPriority ? `&priority=${selectedPriority}` : ''}`}
                isActive={selectedType === value}
              />
            ))}
          </div>
        </div>

        {/* Priority filter */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">{actionsText.priorityFilter}</p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label={actionsText.all}
              href={selectedType ? `/actions?type=${selectedType}` : '/actions'}
              isActive={!selectedPriority}
            />
            {priorityOptions.map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                href={`/actions?priority=${value}${selectedType ? `&type=${selectedType}` : ''}`}
                isActive={selectedPriority === value}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface FilterChipProps {
  label: string
  href: string
  isActive: boolean
}

function FilterChip({ label, href, isActive }: FilterChipProps) {
  return (
    <Link
      to={href as '/'}
      className={cn(
        'px-3 py-1.5 text-sm rounded-full border transition-colors',
        isActive
          ? 'bg-primary text-white border-primary'
          : 'bg-card text-muted-foreground border-border hover:border-primary hover:text-primary'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
    </Link>
  )
}

// Action group by priority
interface ActionGroupProps {
  priority: ActionPriority
  actions: Action[]
  onComplete: (id: string) => void
}

function ActionGroup({ priority, actions, onComplete }: ActionGroupProps) {
  const priorityLabel = ACTION_PRIORITY_LABELS[priority] || priority

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <SortAsc className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {priorityLabel} ({actions.length})
        </h2>
      </div>
      <div className="space-y-3">
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} onComplete={onComplete} />
        ))}
      </div>
    </div>
  )
}

// Empty state component
function EmptyState() {
  const { actions: actionsText } = UI_TEXT

  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {actionsText.noActions}
      </h3>
      <p className="text-muted-foreground">
        {actionsText.allDone}
      </p>
    </div>
  )
}

// Helper function to group actions by priority
function groupActionsByPriority(
  actions: Action[]
): { priority: ActionPriority; actions: Action[] }[] {
  const priorityOrder: ActionPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']
  const grouped = new Map<ActionPriority, Action[]>()

  // Initialize with empty arrays
  priorityOrder.forEach((p) => grouped.set(p, []))

  // Group actions
  actions.forEach((action) => {
    const existing = grouped.get(action.priority) || []
    existing.push(action)
    grouped.set(action.priority, existing)
  })

  // Return only non-empty groups in priority order
  return priorityOrder
    .filter((p) => (grouped.get(p)?.length ?? 0) > 0)
    .map((priority) => ({
      priority,
      actions: grouped.get(priority) || [],
    }))
}
