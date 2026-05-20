import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api, type ActivityTimelineItem } from '../../lib/api-client'
import { ActivityRow } from './activity-row'

type ActivityTimelineProps = {
  scope: 'recent' | 'client'
  clientId?: string
  title?: string
  limit?: number
}

export function ActivityTimeline({
  scope,
  clientId,
  title,
  limit = 20,
}: ActivityTimelineProps) {
  const { t } = useTranslation()
  const filters = { limit }
  const query = useQuery({
    queryKey: ['activity', scope, clientId ?? null, filters],
    queryFn: () => scope === 'client' && clientId
      ? api.activity.client(clientId, filters)
      : api.activity.recent(filters),
    enabled: scope !== 'client' || Boolean(clientId),
    staleTime: 30_000,
  })

  return (
    <section className="flex max-h-[640px] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">
          {title ?? t(scope === 'client' ? 'clientOverview.recentActivity' : 'dashboard.recentActivity')}
        </h2>
      </div>
      <div className="min-h-0 overflow-y-auto pr-1">
        <ActivityTimelineContent
          items={query.data?.data ?? []}
          isLoading={query.isLoading}
          isError={query.isError}
          emptyLabel={t(scope === 'client' ? 'activity.empty.client' : 'activity.empty.recent')}
          errorLabel={t('activity.error')}
          onRetry={() => void query.refetch()}
        />
      </div>
    </section>
  )
}

type ActivityTimelineContentProps = {
  items: ActivityTimelineItem[]
  isLoading?: boolean
  isError?: boolean
  emptyLabel: string
  errorLabel: string
  onRetry?: () => void
}

export function ActivityTimelineContent({
  items,
  isLoading,
  isError,
  emptyLabel,
  errorLabel,
  onRetry,
}: ActivityTimelineContentProps) {
  const { t } = useTranslation()

  if (isLoading) return <ActivityTimelineSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-destructive/5 px-4 py-8 text-center">
        <AlertCircle className="mb-2 h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="text-sm text-destructive">{errorLabel}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 text-sm font-medium text-primary hover:underline">
            {t('common.retry')}
          </button>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute bottom-4 left-[25px] top-4 w-px bg-border" aria-hidden="true" />
      <div className="space-y-1">
        {items.map((item) => <ActivityRow key={item.id} item={item} />)}
      </div>
    </div>
  )
}

function ActivityTimelineSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading activity">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex gap-3 px-2 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
