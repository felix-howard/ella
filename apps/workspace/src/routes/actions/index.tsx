/**
 * Action Queue Page - Lists all pending actions for staff
 * Features: Filter by type/priority, grouped sections, complete actions
 */

import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { PageContainer } from '../../components/layout'
import { ActionCard } from '../../components/actions'
import {
  Filter,
  CheckSquare,
  SortAsc,
  RefreshCw,
  Inbox,
} from 'lucide-react'
import { cn } from '@ella/ui'
import {
  UI_TEXT,
  ACTION_TYPE_LABELS,
  ACTION_PRIORITY_LABELS,
} from '../../lib/constants'
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

// Mock data with static timestamps - will be replaced with API call
const MOCK_ACTIONS: Action[] = [
  {
    id: '1',
    caseId: 'case-1',
    type: 'VERIFY_DOCS',
    priority: 'URGENT',
    title: 'Xác minh W2 - Nguyễn Văn A',
    description: 'W2 mới được upload, cần xác minh thông tin',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-13T07:30:00Z',
    taxCase: { id: 'case-1', client: { id: 'client-1', name: 'Nguyễn Văn A' } },
  },
  {
    id: '2',
    caseId: 'case-2',
    type: 'BLURRY_DETECTED',
    priority: 'HIGH',
    title: 'Ảnh mờ - SSN Card',
    description: 'Ảnh SSN Card không rõ, cần yêu cầu gửi lại',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-13T06:00:00Z',
    taxCase: { id: 'case-2', client: { id: 'client-2', name: 'Trần Thị B' } },
  },
  {
    id: '3',
    caseId: 'case-3',
    type: 'AI_FAILED',
    priority: 'HIGH',
    title: 'AI không nhận diện được tài liệu',
    description: 'Cần phân loại thủ công tài liệu mới upload',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-13T04:00:00Z',
    taxCase: { id: 'case-3', client: { id: 'client-3', name: 'Lê Văn C' } },
  },
  {
    id: '4',
    caseId: 'case-4',
    type: 'READY_FOR_ENTRY',
    priority: 'NORMAL',
    title: 'Sẵn sàng nhập liệu',
    description: 'Tất cả tài liệu đã xác minh, có thể nhập liệu',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-12T08:00:00Z',
    taxCase: { id: 'case-4', client: { id: 'client-4', name: 'Phạm Thị D' } },
  },
  {
    id: '5',
    caseId: 'case-5',
    type: 'CLIENT_REPLIED',
    priority: 'NORMAL',
    title: 'Khách hàng trả lời tin nhắn',
    description: 'Có tin nhắn mới từ khách hàng',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-13T03:00:00Z',
    taxCase: { id: 'case-5', client: { id: 'client-5', name: 'Hoàng Văn E' } },
  },
  {
    id: '6',
    caseId: 'case-6',
    type: 'REMINDER_DUE',
    priority: 'LOW',
    title: 'Cần gửi nhắc nhở',
    description: '3 ngày chưa có tài liệu mới',
    isCompleted: false,
    assignedToId: null,
    createdAt: '2026-01-10T08:00:00Z',
    taxCase: { id: 'case-6', client: { id: 'client-6', name: 'Vũ Thị F' } },
  },
]

function ActionsPage() {
  const { type: filterType, priority: filterPriority } = useSearch({
    from: '/actions/',
  })

  const [isLoading, setIsLoading] = useState(false)
  const { actions: actionsText } = UI_TEXT

  // Apply filters
  const filteredActions = MOCK_ACTIONS.filter((action) => {
    if (filterType && action.type !== filterType) return false
    if (filterPriority && action.priority !== filterPriority) return false
    return true
  })

  // Group by priority
  const groupedActions = groupActionsByPriority(filteredActions)

  const handleComplete = async (_actionId: string) => {
    setIsLoading(true)
    // TODO: Call api.actions.complete(actionId) when API is integrated
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    // TODO: Refetch actions
    setTimeout(() => setIsLoading(false), 500)
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
              {filteredActions.length} {actionsText.pendingCount}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">{actionsText.refresh}</span>
        </button>
      </div>

      {/* Filters */}
      <ActionFilters
        selectedType={filterType}
        selectedPriority={filterPriority}
      />

      {/* Action List */}
      {filteredActions.length === 0 ? (
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
