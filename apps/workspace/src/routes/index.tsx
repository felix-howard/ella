/**
 * Dashboard Page - Main landing page for staff workspace
 * Displays summary stats, quick actions, and recent activity
 */

import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { PageContainer } from '../components/layout'
import {
  TodaySummary,
  StatsOverview,
  QuickActions,
  type DashboardStats,
} from '../components/dashboard'
import { UI_TEXT } from '../lib/constants'
import { api } from '../lib/api-client'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useUser()
  const userName = user?.fullName || user?.firstName || undefined

  // Fetch actions for stats
  const { data: actionsData } = useSuspenseQuery({
    queryKey: ['actions'],
    queryFn: () => api.actions.list(),
  })

  // Fetch clients for new clients count (today)
  const { data: clientsData } = useSuspenseQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => api.clients.list({ limit: 100 }),
  })

  // Calculate stats from API data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const newClientsToday = clientsData?.data.filter((client) => {
    const createdAt = new Date(client.createdAt)
    return createdAt >= today
  }).length || 0

  // Count blurry docs from actions
  const blurryDocsCount = [...actionsData.urgent, ...actionsData.high, ...actionsData.normal, ...actionsData.low]
    .filter((action) => action.type === 'BLURRY_DETECTED' && !action.isCompleted)
    .length

  const stats: DashboardStats = {
    pendingActions: actionsData.stats.total,
    newClients: newClientsToday,
    docsReceived: 0, // TODO: Add docs received endpoint
    blurryDocs: blurryDocsCount,
  }

  const { dashboard } = UI_TEXT

  return (
    <PageContainer>
      <TodaySummary staffName={userName} />
      <StatsOverview stats={stats} />
      <QuickActions />

      {/* Recent Activity Section */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
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
