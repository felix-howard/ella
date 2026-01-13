/**
 * Stats Overview Component - Dashboard statistics cards grid
 * Displays key metrics with color-coded icons and optional navigation
 */

import { Link } from '@tanstack/react-router'
import {
  CheckSquare,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { UI_TEXT } from '../../lib/constants'

export interface DashboardStats {
  pendingActions: number
  newClients: number
  docsReceived: number
  blurryDocs: number
}

interface StatsOverviewProps {
  stats: DashboardStats
  isLoading?: boolean
}

export function StatsOverview({ stats, isLoading }: StatsOverviewProps) {
  const { dashboard } = UI_TEXT

  const statCards: StatCardData[] = [
    {
      icon: CheckSquare,
      label: dashboard.pendingActions,
      value: stats.pendingActions,
      color: 'primary',
      href: '/actions',
    },
    {
      icon: Users,
      label: dashboard.newClients,
      value: stats.newClients,
      color: 'accent',
      href: '/clients',
    },
    {
      icon: FileText,
      label: dashboard.docsReceived,
      value: stats.docsReceived,
      color: 'success',
    },
    {
      icon: AlertTriangle,
      label: dashboard.blurryDocs,
      value: stats.blurryDocs,
      color: 'warning',
      href: '/actions?type=BLURRY_DETECTED',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statCards.map((card) => (
        <StatCard key={card.label} {...card} isLoading={isLoading} />
      ))}
    </div>
  )
}

// Stat Card types and component
type StatColor = 'primary' | 'accent' | 'success' | 'warning'

interface StatCardData {
  icon: LucideIcon
  label: string
  value: number
  color: StatColor
  href?: string
}

interface StatCardProps extends StatCardData {
  isLoading?: boolean
}

const colorClasses: Record<StatColor, string> = {
  primary: 'bg-primary-light text-primary',
  accent: 'bg-accent-light text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning-light text-warning',
}

function StatCard({ icon: Icon, label, value, color, href, isLoading }: StatCardProps) {
  const content = (
    <div className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            colorClasses[color]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        {href && (
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="mt-3">
        {isLoading ? (
          <div className="h-8 w-12 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link to={href as '/'}>{content}</Link>
  }

  return content
}
