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
          <div key={i} className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-5 animate-pulse">
            <div className="w-11 h-11 bg-muted rounded-xl mb-3" />
            <div className="h-7 w-12 bg-muted rounded mb-1" />
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
      iconColor: 'text-blue-500',
      gradientBg: 'bg-gradient-to-br from-blue-500/15 to-blue-500/5',
    },
    {
      icon: Calendar,
      value: stats.taxYears.length,
      label: t('clientOverview.taxYears'),
      iconColor: 'text-purple-500',
      gradientBg: 'bg-gradient-to-br from-purple-500/15 to-purple-500/5',
    },
    {
      icon: CheckCircle,
      value: `${stats.verifiedPercent}%`,
      label: t('clientOverview.verified'),
      iconColor: 'text-emerald-500',
      gradientBg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
    },
    {
      icon: MessageSquare,
      value: stats.lastMessageAt ? formatRelativeTime(stats.lastMessageAt) : '-',
      label: t('clientOverview.lastMessage'),
      iconColor: 'text-amber-500',
      gradientBg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5',
      isSmallText: !!stats.lastMessageAt,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        return (
          <div key={index} className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-5 group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-3', stat.gradientBg)}>
              <Icon className={cn('w-5 h-5', stat.iconColor)} />
            </div>
            <div className={cn(
              'font-bold text-foreground',
              stat.isSmallText ? 'text-base' : 'text-3xl'
            )}>
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        )
      })}
    </div>
  )
}
