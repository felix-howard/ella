/**
 * Client Quick Stats - 4 stat cards showing key metrics
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Calendar, CheckCircle, MessageSquare } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { formatRelativeTime } from '../../../lib/formatters'

interface ClientQuickStatsProps {
  clientId: string
}

export function ClientQuickStats({ clientId }: ClientQuickStatsProps) {
  const { t } = useTranslation()

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['client-stats', clientId],
    queryFn: () => api.clients.getStats(clientId),
    staleTime: 60000, // Cache for 1 minute
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="w-8 h-8 bg-muted rounded-lg mb-3" />
            <div className="h-6 w-12 bg-muted rounded mb-1" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !stats) {
    return null
  }

  const statCards = [
    {
      icon: FolderOpen,
      value: stats.totalFiles,
      label: t('clientOverview.totalFiles'),
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      icon: Calendar,
      value: stats.taxYears.length,
      label: t('clientOverview.taxYears'),
      color: 'text-purple-500 bg-purple-500/10',
    },
    {
      icon: CheckCircle,
      value: `${stats.verifiedPercent}%`,
      label: t('clientOverview.verified'),
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      icon: MessageSquare,
      value: stats.lastMessageAt ? formatRelativeTime(stats.lastMessageAt) : '-',
      label: t('clientOverview.lastMessage'),
      color: 'text-amber-500 bg-amber-500/10',
      isSmallText: !!stats.lastMessageAt,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        return (
          <div key={index} className="bg-card rounded-xl border border-border p-4">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', stat.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className={cn(
              'font-semibold text-foreground',
              stat.isSmallText ? 'text-base' : 'text-2xl'
            )}>
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        )
      })}
    </div>
  )
}
