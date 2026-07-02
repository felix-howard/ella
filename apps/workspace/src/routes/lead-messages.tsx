import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { MessageCircle } from 'lucide-react'
import { LeadConversationList } from '../components/messaging'
import { useUIStore } from '../stores/ui-store'
import { useIsMobile } from '../hooks/use-mobile-breakpoint'
import { adjustUnreadCount, getMessageEventType, useRealtimeMessages } from '../hooks/use-realtime-messages'
import { api } from '../lib/api-client'
import { logMessageRealtimeDebug } from '../lib/realtime-message-events'
import type { LeadConversation } from '../lib/api-client'

export const Route = createFileRoute('/lead-messages')({ component: LeadMessagesLayout })

const FALLBACK_POLLING_INTERVAL = 60000

function getLeadConversationUnreadPatch(
  conversations: LeadConversation[],
  leadId: string,
  nextUnreadCount: number
) {
  const previousUnreadCount = conversations.find((conversation) => conversation.leadId === leadId)?.unreadCount ?? 0
  const safeNextUnreadCount = Math.max(0, nextUnreadCount)

  if (previousUnreadCount === safeNextUnreadCount) {
    return { conversations, previousUnreadCount, nextUnreadCount: safeNextUnreadCount, changed: false }
  }

  return {
    conversations: conversations.map((conversation) =>
      conversation.leadId === leadId ? { ...conversation, unreadCount: safeNextUnreadCount } : conversation
    ),
    previousUnreadCount,
    nextUnreadCount: safeNextUnreadCount,
    changed: true,
  }
}

function LeadMessagesLayout() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<LeadConversation[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [_isRefreshing, setIsRefreshing] = useState(false)
  const conversationsRef = useRef<LeadConversation[]>([])
  const activeLeadIdRef = useRef<string | undefined>(undefined)
  const queryClient = useQueryClient()
  const { sidebarCollapsed } = useUIStore()
  const isMobile = useIsMobile()
  const params = useParams({ strict: false })
  const activeLeadId = (params as { leadId?: string }).leadId
  activeLeadIdRef.current = activeLeadId

  const patchLeadUnread = useCallback((leadId: string, nextUnreadCount: number) => {
    const unreadPatch = getLeadConversationUnreadPatch(conversationsRef.current, leadId, nextUnreadCount)
    if (!unreadPatch.changed) return

    conversationsRef.current = unreadPatch.conversations
    setConversations(unreadPatch.conversations)
    setTotalUnread((current) =>
      adjustUnreadCount(current, unreadPatch.previousUnreadCount, unreadPatch.nextUnreadCount)
    )
    queryClient.setQueryData<{ totalUnread: number }>(['lead-unread-summary'], (current) =>
      current
        ? {
            ...current,
            totalUnread: adjustUnreadCount(
              current.totalUnread,
              unreadPatch.previousUnreadCount,
              unreadPatch.nextUnreadCount
            ),
          }
        : current
    )
    queryClient.setQueryData(['unread-count', 'lead', leadId], {
      leadId,
      unreadCount: unreadPatch.nextUnreadCount,
    })
  }, [queryClient])

  const fetchConversations = useCallback(async (silent = false) => {
    const showInitialLoading = !silent && conversationsRef.current.length === 0
    if (showInitialLoading) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const currentActiveLeadId = activeLeadIdRef.current
      const response = await api.leads.messages.listConversations({ limit: 50 })
      let nextConversations = response.conversations
      let nextTotalUnread = response.totalUnread

      if (currentActiveLeadId) {
        const unreadPatch = getLeadConversationUnreadPatch(nextConversations, currentActiveLeadId, 0)
        nextConversations = unreadPatch.conversations
        nextTotalUnread = adjustUnreadCount(
          nextTotalUnread,
          unreadPatch.previousUnreadCount,
          unreadPatch.nextUnreadCount
        )
      }

      nextConversations.forEach((conversation) => {
        queryClient.setQueryData(['messages', 'lead-conversation-summary', conversation.leadId], conversation)
      })
      conversationsRef.current = nextConversations
      setConversations(nextConversations)
      setTotalUnread(nextTotalUnread)
      queryClient.setQueryData(['lead-conversations'], response)
      queryClient.setQueryData(['lead-unread-summary'], { totalUnread: nextTotalUnread })
    } catch (error) {
      logMessageRealtimeDebug('lead-messages-layout.fetch.error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      if (import.meta.env.DEV) console.error('Failed to fetch lead conversations:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [queryClient])

  useRealtimeMessages({
    onEvent: (event) => {
      if (!event.leadId) return
      const eventType = getMessageEventType(event)

      if (event.eventType === 'lead.read' && event.leadId === activeLeadId) {
        patchLeadUnread(event.leadId, event.unreadCount)
      }
      if (
        eventType === 'message.created'
        && event.leadId === activeLeadId
        && 'direction' in event
        && event.direction === 'INBOUND'
      ) {
        patchLeadUnread(event.leadId, 0)
      }
      void fetchConversations(true)
    },
  })

  useEffect(() => {
    if (!activeLeadId) return
    patchLeadUnread(activeLeadId, 0)
    void fetchConversations(true)
  }, [activeLeadId, fetchConversations, patchLeadUnread])

  useEffect(() => {
    void fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchConversations(true)
    }, FALLBACK_POLLING_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchConversations])

  const conversationPanel = (
    <>
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-success" />
          </div>
          <h1 className="truncate text-base font-semibold text-foreground tracking-tight">
            {t('leadMessages.title')}
          </h1>
          {totalUnread > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 text-[11px] font-semibold bg-success text-white rounded-full inline-flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </div>
      </div>
      <div className="mx-4 h-px bg-border/60" />
      <LeadConversationList conversations={conversations} activeLeadId={activeLeadId} isLoading={isLoading} />
    </>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-background pt-14">
        {activeLeadId ? <Outlet /> : <div className="flex-1 flex flex-col bg-card min-h-0">{conversationPanel}</div>}
      </div>
    )
  }

  return (
    <div className={cn('fixed inset-0 flex bg-background transition-all duration-300', sidebarCollapsed ? 'pl-16' : 'pl-60')}>
      <div className="w-80 flex-shrink-0 bg-[#f7f7f8] dark:bg-card flex flex-col shadow-[1px_0_8px_-2px_rgba(0,0,0,0.08)]">
        {conversationPanel}
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <Outlet />
      </div>
    </div>
  )
}
