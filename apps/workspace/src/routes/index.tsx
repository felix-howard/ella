/**
 * Dashboard Page - Main landing page for staff workspace
 * Displays summary stats, quick actions, and recent activity
 */

import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '../components/layout'
import {
  TodaySummary,
  StatsOverview,
  QuickActions,
  type DashboardStats,
} from '../components/dashboard'
import { UI_TEXT } from '../lib/constants'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  // TODO: Replace with API call using useSuspenseQuery
  const stats: DashboardStats = {
    pendingActions: 12,
    newClients: 3,
    docsReceived: 28,
    blurryDocs: 2,
  }

  const { dashboard } = UI_TEXT

  return (
    <PageContainer>
      <TodaySummary />
      <StatsOverview stats={stats} />
      <QuickActions />

      {/* Recent Activity Section */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">
          {dashboard.recentActivity}
        </h2>
        <div className="text-center py-8 text-muted-foreground">
          <p>{dashboard.noRecentActivity}</p>
        </div>
      </div>
    </PageContainer>
  )
}
