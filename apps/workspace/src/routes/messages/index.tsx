/**
 * Unified Inbox Page - All client conversations in one place
 * Split view: conversation list (left) + message thread (right)
 */

import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, Outlet, useParams, useNavigate } from '@tanstack/react-router'
import { cn } from '@ella/ui'
import { MessageSquare, RefreshCw, Bell, BellOff } from 'lucide-react'
import { ConversationList } from '../../components/messaging'
import { useUIStore } from '../../stores/ui-store'
import { api } from '../../lib/api-client'
import type { Conversation } from '../../lib/api-client'

export const Route = createFileRoute('/messages/')({
  component: InboxPage,
})

// Polling interval (30 seconds)
const POLLING_INTERVAL = 30000

function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { sidebarCollapsed } = useUIStore()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const activeCaseId = (params as { caseId?: string }).caseId

  // Fetch conversations
  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await api.messages.listConversations({
        unreadOnly: showUnreadOnly,
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
  }, [showUnreadOnly])

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

  // Navigate to first conversation if none selected and conversations exist
  useEffect(() => {
    if (!activeCaseId && conversations.length > 0 && !isLoading) {
      navigate({
        to: '/messages/$caseId',
        params: { caseId: conversations[0].caseId },
      })
    }
  }, [activeCaseId, conversations, isLoading, navigate])

  return (
    <div
      className={cn(
        'h-screen flex bg-background transition-all duration-300',
        sidebarCollapsed ? 'ml-16' : 'ml-60'
      )}
    >
      {/* Left Panel - Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Tin nhắn</h1>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-error text-white rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showUnreadOnly
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              title={showUnreadOnly ? 'Hiện tất cả' : 'Chỉ chưa đọc'}
              aria-label={showUnreadOnly ? 'Hiện tất cả tin nhắn' : 'Chỉ hiện tin chưa đọc'}
              aria-pressed={showUnreadOnly}
            >
              {showUnreadOnly ? (
                <Bell className="w-4 h-4" aria-hidden="true" />
              ) : (
                <BellOff className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                isRefreshing && 'animate-spin'
              )}
              title="Làm mới"
              aria-label="Làm mới danh sách tin nhắn"
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
      </div>

      {/* Right Panel - Message Thread or Empty State */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeCaseId ? (
          <Outlet />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium text-foreground mb-2">
                Chọn cuộc hội thoại
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu nhắn tin
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
