/**
 * Lead List Stats Bar - 4 KPI cards (Total / New / Sent / Converted + conversion %)
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users, Sparkles, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subLabel?: string
  iconClass: string
}

function StatCard({ icon, label, value, subLabel, iconClass }: StatCardProps) {
  return (
    <div className="flex-1 min-w-[140px] bg-card border border-border/60 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconClass)}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
        {subLabel && <span className="text-xs text-muted-foreground">{subLabel}</span>}
      </div>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="flex-1 min-w-[140px] bg-card border border-border/60 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
    </div>
  )
}

export function LeadListStatsBar() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['leads-stats'],
    queryFn: () => api.leads.stats(),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const stats = data?.data
  if (!stats) return null

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <StatCard
        icon={<Users className="w-4 h-4 text-indigo-600" aria-hidden="true" />}
        label={t('leads.statsTotal', 'Total')}
        value={stats.total}
        iconClass="bg-indigo-100"
      />
      <StatCard
        icon={<Sparkles className="w-4 h-4 text-blue-600" aria-hidden="true" />}
        label={t('leads.statsNew', 'New')}
        value={stats.new}
        iconClass="bg-blue-100"
      />
      <StatCard
        icon={<Send className="w-4 h-4 text-purple-600" aria-hidden="true" />}
        label={t('leads.statsSent', 'Sent')}
        value={stats.sent}
        iconClass="bg-purple-100"
      />
      <StatCard
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />}
        label={t('leads.statsConverted', 'Converted')}
        value={stats.converted}
        subLabel={`${stats.conversionRate}%`}
        iconClass="bg-emerald-100"
      />
    </div>
  )
}
