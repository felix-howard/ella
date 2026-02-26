/**
 * Client Activity Timeline - Vertical timeline of recent activities
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileUp, MessageSquare, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type ClientActivity } from '../../../lib/api-client'
import { formatRelativeTime } from '../../../lib/formatters'

interface ClientActivityTimelineProps {
  clientId: string
}

const activityIcons = {
  upload: FileUp,
  message: MessageSquare,
  case_updated: RefreshCw,
}

const activityColors = {
  upload: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  message: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  case_updated: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
}

export function ClientActivityTimeline({ clientId }: ClientActivityTimelineProps) {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-activity', clientId],
    queryFn: () => api.clients.getActivity(clientId),
    staleTime: 30000, // Cache for 30 seconds
  })

  const activities = data?.data ?? []

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-base font-semibold text-foreground mb-4">
          {t('clientOverview.recentActivity')}
        </h3>
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return null
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-base font-semibold text-foreground mb-4">
        {t('clientOverview.recentActivity')}
      </h3>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{t('clientOverview.noActivity')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

          {/* Activity items */}
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityItem({ activity }: { activity: ClientActivity }) {
  const Icon = activityIcons[activity.type] || RefreshCw
  const colorClass = activityColors[activity.type] || activityColors.case_updated

  return (
    <div className="flex gap-3 relative">
      {/* Icon */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border z-10',
        colorClass
      )}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <p className="text-sm text-foreground leading-relaxed">
          {activity.description}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
    </div>
  )
}
