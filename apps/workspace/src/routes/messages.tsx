/**
 * Messages Layout - Parent layout for all /messages/* routes
 * Shows conversation list on left, child route content on right
 */

import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { ConversationList } from '../components/messaging'
import { useUIStore } from '../stores/ui-store'
import { useIsMobile } from '../hooks/use-mobile-breakpoint'
import { api } from '../lib/api-client'
import type { Conversation } from '../lib/api-client'

export const Route = createFileRoute('/messages')({
  component: MessagesLayout,
})

// Polling interval (30 seconds)
const POLLING_INTERVAL = 30000

function MessagesLayout() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { sidebarCollapsed } = useUIStore()
  const isMobile = useIsMobile()
  const params = useParams({ strict: false })
  const activeCaseId = (params as { caseId?: string }).caseId

  // Fetch conversations
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await api.messages.listConversations({
        limit: 50,
      })
      setConversations(response.conversations)
      setTotalUnread(response.totalUnread)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch conversations:', error)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true)
    }, POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchConversations])

  // Handle manual refresh
  const handleRefresh = () => {
    fetchConversations(true)
  }

  // Shared conversation list header + list
  const conversationPanel = (
    <>
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t('messages.title')}</h1>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-error text-white rounded-full">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              isRefreshing && 'animate-spin'
            )}
            title={t('messages.refresh')}
            aria-label={t('messages.refreshAriaLabel')}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <ConversationList
        conversations={conversations}
        activeCaseId={activeCaseId}
        isLoading={isLoading}
      />
    </>
  )

  // Mobile: single-panel - show list OR detail based on URL
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-background pt-14">
        {activeCaseId ? (
          <div className="flex-1 flex flex-col min-w-0">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-card">
            {conversationPanel}
          </div>
        )}
      </div>
    )
  }

  // Desktop: split-view (unchanged)
  return (
    <div
      className={cn(
        'fixed inset-0 flex bg-background transition-all duration-300',
        sidebarCollapsed ? 'pl-16' : 'pl-60'
      )}
    >
      {/* Left Panel - Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card flex flex-col">
        {conversationPanel}
      </div>

      {/* Right Panel - Child Route Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
