import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '../components/layout'
import {
  CheckSquare,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@ella/ui'
import { UI_TEXT } from '../lib/constants'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  // Mock data - will be replaced with API calls
  const stats = {
    pendingActions: 12,
    newClients: 3,
    docsReceived: 28,
    blurryDocs: 2,
  }

  const { dashboard, quickAction, staff } = UI_TEXT

  return (
    <PageContainer>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {dashboard.greeting}, <span className="text-accent">{staff.defaultName}</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {dashboard.greetingSubtext}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={CheckSquare}
          label={dashboard.pendingActions}
          value={stats.pendingActions}
          color="primary"
          href="/actions"
        />
        <StatCard
          icon={Users}
          label={dashboard.newClients}
          value={stats.newClients}
          color="accent"
          href="/clients"
        />
        <StatCard
          icon={FileText}
          label={dashboard.docsReceived}
          value={stats.docsReceived}
          color="success"
        />
        <StatCard
          icon={AlertTriangle}
          label={dashboard.blurryDocs}
          value={stats.blurryDocs}
          color="warning"
          href="/actions?type=BLURRY_DETECTED"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <h2 className="text-lg font-semibold text-primary mb-4">{dashboard.quickActions}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionButton
            icon={Users}
            label={quickAction.addClient}
            href="/clients/new"
          />
          <QuickActionButton
            icon={CheckSquare}
            label={quickAction.viewActions}
            href="/actions"
          />
          <QuickActionButton
            icon={FileText}
            label={quickAction.verifyDocs}
            href="/actions?type=VERIFY_DOCS"
          />
          <QuickActionButton
            icon={AlertTriangle}
            label={quickAction.handleBlurry}
            href="/actions?type=BLURRY_DETECTED"
          />
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">{dashboard.recentActivity}</h2>
        <div className="text-center py-8 text-muted-foreground">
          <p>{dashboard.noRecentActivity}</p>
        </div>
      </div>
    </PageContainer>
  )
}

// Stat Card Component
interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: 'primary' | 'accent' | 'success' | 'warning'
  href?: string
}

function StatCard({ icon: Icon, label, value, color, href }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-light text-primary',
    accent: 'bg-accent-light text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning-light text-warning',
  }

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
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link to={href as '/'}>{content}</Link>
  }

  return content
}

// Quick Action Button Component
interface QuickActionButtonProps {
  icon: React.ElementType
  label: string
  href: string
}

function QuickActionButton({ icon: Icon, label, href }: QuickActionButtonProps) {
  return (
    <Link
      to={href as '/'}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-primary-light hover:border-primary transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors text-center">
        {label}
      </span>
    </Link>
  )
}
