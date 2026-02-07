/**
 * Action Queue Page - Lists all pending actions for staff
 * Features: Dashboard overview, quick actions, filter by type/priority, completed history
 */

import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../../components/layout'
import { ActionCard } from '../../components/actions'
import {
  Filter,
  CheckSquare,
  SortAsc,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileCheck,
  AlertTriangle,
  ImageOff,
  Clock,
  MessageCircle,
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  History,
  BarChart3,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import {
  UI_TEXT,
  ACTION_TYPE_LABELS,
  ACTION_PRIORITY_LABELS,
  ACTION_TYPE_COLORS,
} from '../../lib/constants'
import { api } from '../../lib/api-client'
import type { Action, ActionType, ActionPriority } from '../../lib/api-client'

// Search params validation
type ActionSearchParams = {
  type?: ActionType
  priority?: ActionPriority
  tab?: 'pending' | 'completed'
}

export const Route = createFileRoute('/actions/')({
  component: ActionsPage,
  validateSearch: (search: Record<string, unknown>): ActionSearchParams => ({
    type: search.type as ActionType | undefined,
    priority: search.priority as ActionPriority | undefined,
    tab: (search.tab as 'pending' | 'completed') || 'pending',
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { type: filterType, priority: filterPriority, tab = 'pending' } = useSearch({
    from: '/actions/',
  })
  const { actions: actionsText } = UI_TEXT

  // Fetch pending actions
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

  // Fetch completed actions for history tab
  const {
    data: completedData,
    isLoading: isLoadingCompleted,
  } = useQuery({
    queryKey: ['actions', 'completed'],
    queryFn: () =>
      api.actions.list({
        isCompleted: true,
      }) as Promise<ActionsGroupedResponse>,
    enabled: tab === 'completed',
  })

  // Complete action mutation
  const completeMutation = useMutation({
    mutationFn: (actionId: string) => api.actions.complete(actionId),
    onSuccess: () => {
      toast.success(t('actions.completeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    },
    onError: () => {
      toast.error(t('actions.completeError'))
    },
  })

  // Combine all actions for filtering and grouping
  const allActions: Action[] = actionsData
    ? [...actionsData.urgent, ...actionsData.high, ...actionsData.normal, ...actionsData.low]
    : []

  const allCompletedActions: Action[] = completedData
    ? [...completedData.urgent, ...completedData.high, ...completedData.normal, ...completedData.low]
    : []

  // Group by priority
  const groupedActions = groupActionsByPriority(allActions)

  const handleComplete = (actionId: string) => {
    completeMutation.mutate(actionId)
  }

  const handleRefresh = () => {
    refetch()
  }

  const stats = actionsData?.stats || { total: 0, urgent: 0, high: 0, normal: 0, low: 0 }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {actionsText.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} {actionsText.pendingCount}
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

      {/* Dashboard Stats - Always visible */}
      <ActionsDashboard stats={stats} isLoading={isLoading} />

      {/* Quick Actions - Always visible */}
      <QuickActionsPanel stats={stats} />

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <Link
          to="/actions"
          search={{ tab: 'pending' }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'pending'
              ? 'bg-primary text-white'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary'
          )}
        >
          <CheckSquare className="w-4 h-4" />
          {t('actions.tabPending', { count: stats.total })}
        </Link>
        <Link
          to="/actions"
          search={{ tab: 'completed' }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'completed'
              ? 'bg-primary text-white'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary'
          )}
        >
          <History className="w-4 h-4" />
          {t('actions.tabCompleted')}
        </Link>
      </div>

      {/* Filters - Only for pending tab */}
      {tab === 'pending' && (
        <ActionFilters
          selectedType={filterType}
          selectedPriority={filterPriority}
        />
      )}

      {/* Content based on tab */}
      {tab === 'pending' ? (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{t('actions.loadingActions')}</p>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('actions.errorLoadingList')}</h3>
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
        </>
      ) : (
        <CompletedActionsHistory
          actions={allCompletedActions}
          isLoading={isLoadingCompleted}
        />
      )}
    </PageContainer>
  )
}

// Dashboard stats component
interface ActionsDashboardProps {
  stats: { total: number; urgent: number; high: number; normal: number; low: number }
  isLoading: boolean
}

function ActionsDashboard({ stats, isLoading }: ActionsDashboardProps) {
  const { t } = useTranslation()
  const statCards = [
    {
      label: t('actions.statsTotalPending'),
      value: stats.total,
      icon: BarChart3,
      color: 'text-primary',
      bg: 'bg-primary-light',
    },
    {
      label: t('actions.statsUrgent'),
      value: stats.urgent,
      icon: AlertTriangle,
      color: 'text-error',
      bg: 'bg-error-light',
    },
    {
      label: t('actions.statsHigh'),
      value: stats.high,
      icon: TrendingUp,
      color: 'text-accent',
      bg: 'bg-accent-light',
    },
    {
      label: t('actions.statsNormal'),
      value: stats.normal + stats.low,
      icon: Clock,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl border border-border p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0', stat.bg)}>
              <stat.icon className={cn('w-4 h-4 sm:w-5 sm:h-5', stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {isLoading ? '-' : stat.value}
              </p>
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Quick actions panel
interface QuickActionsPanelProps {
  stats: { total: number; urgent: number; high: number; normal: number; low: number }
}

function QuickActionsPanel({ stats: _stats }: QuickActionsPanelProps) {
  const { t } = useTranslation()
  const quickActions = [
    {
      label: t('actions.quickActionVerifyDocs'),
      description: t('actions.quickActionVerifyDocsDesc'),
      href: '/actions?type=VERIFY_DOCS',
      icon: FileCheck,
      color: 'text-primary',
      bg: 'bg-primary-light',
    },
    {
      label: t('actions.quickActionAiFailed'),
      description: t('actions.quickActionAiFailedDesc'),
      href: '/actions?type=AI_FAILED',
      icon: AlertTriangle,
      color: 'text-error',
      bg: 'bg-error-light',
    },
    {
      label: t('actions.quickActionBlurry'),
      description: t('actions.quickActionBlurryDesc'),
      href: '/actions?type=BLURRY_DETECTED',
      icon: ImageOff,
      color: 'text-warning',
      bg: 'bg-warning-light',
    },
    {
      label: t('actions.quickActionClientReplied'),
      description: t('actions.quickActionClientRepliedDesc'),
      href: '/actions?type=CLIENT_REPLIED',
      icon: MessageCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ]

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-primary" />
        {t('actions.quickActions')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            to={action.href as '/'}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-all group"
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', action.bg)}>
              <action.icon className={cn('w-4 h-4', action.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{action.label}</p>
              <p className="text-xs text-muted-foreground truncate">{action.description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// Completed actions history
interface CompletedActionsHistoryProps {
  actions: Action[]
  isLoading: boolean
}

function CompletedActionsHistory({ actions, isLoading }: CompletedActionsHistoryProps) {
  const { t } = useTranslation()
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">{t('actions.loadingHistory')}</p>
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <History className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('actions.noHistory')}
        </h3>
        <p className="text-muted-foreground">
          {t('actions.noHistoryDesc')}
        </p>
      </div>
    )
  }

  // Sort by completion time (most recent first) - using createdAt as proxy
  const sortedActions = [...actions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-medium text-foreground">
          {t('actions.completedCount', { count: actions.length })}
        </h3>
      </div>
      <div className="divide-y divide-border">
        {sortedActions.slice(0, 20).map((action) => (
          <CompletedActionItem key={action.id} action={action} />
        ))}
      </div>
      {actions.length > 20 && (
        <div className="px-4 py-3 bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">
            {t('actions.showingCount', { shown: 20, total: actions.length })}
          </p>
        </div>
      )}
    </div>
  )
}

function CompletedActionItem({ action }: { action: Action }) {
  const { t } = useTranslation()
  const typeConfig = ACTION_TYPE_COLORS[action.type] || { bg: 'bg-muted', text: 'text-muted-foreground' }
  const typeLabel = ACTION_TYPE_LABELS[action.type] || action.type

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', typeConfig.bg)}>
        <CheckCircle className={cn('w-4 h-4', typeConfig.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{action.title}</p>
        <p className="text-xs text-muted-foreground">
          {typeLabel} • {action.taxCase?.client?.name || t('actions.unknownClient')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          {formatRelativeTime(action.createdAt, t)}
        </p>
      </div>
    </div>
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
  const { t } = useTranslation()
  const { actions: actionsText } = UI_TEXT

  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 mx-auto mb-4 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-success" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {actionsText.noActions}
      </h3>
      <p className="text-muted-foreground mb-4">
        {actionsText.allDone}
      </p>
      <Link
        to="/clients"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <Users className="w-4 h-4" />
        {t('actions.viewClientList')}
      </Link>
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

// Helper to format relative time
function formatRelativeTime(dateString: string, t: (key: string, options?: { count?: number }) => string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return t('actions.timeJustNow')
  if (diffMins < 60) return t('actions.timeMinutesAgo', { count: diffMins })
  if (diffHours < 24) return t('actions.timeHoursAgo', { count: diffHours })
  if (diffDays < 7) return t('actions.timeDaysAgo', { count: diffDays })
  return date.toLocaleDateString('vi-VN')
}
