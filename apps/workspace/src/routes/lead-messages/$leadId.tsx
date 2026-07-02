import { useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ArrowLeft } from 'lucide-react'
import { LeadMessageLoadError, MessageThread, QuickActionsBar } from '../../components/messaging'
import { LeadStatusBadge } from '../../components/leads/lead-status-badge'
import { useOrgRole } from '../../hooks/use-org-role'
import { useRealtimeMessages } from '../../hooks/use-realtime-messages'
import { useSendChatMessage } from '../../hooks/use-send-chat-message'
import { formatPhone, getAvatarColor, getInitials, maskPhone } from '../../lib/formatters'
import { api } from '../../lib/api-client'
import type { ComposeTranslationMetadata, Lead, LeadConversation, Message } from '../../lib/api-client'

export const Route = createFileRoute('/lead-messages/$leadId')({ component: LeadMessageDetailView })

const FALLBACK_POLLING_INTERVAL = 60000

type DisplayLead = Pick<Lead, 'id' | 'firstName' | 'lastName' | 'phone' | 'status' | 'campaignTag' | 'tags'> & { name: string }

function getDisplayLead(lead: Lead | LeadConversation['lead'] | undefined): DisplayLead | null {
  if (!lead) return null
  return { ...lead, name: 'name' in lead ? lead.name : `${lead.firstName} ${lead.lastName}`.trim() }
}

function getLatestServerMessageAt(messages: Message[]): string | undefined {
  return messages.filter((message) => !message.id.startsWith('temp-')).at(-1)?.createdAt
}

function LeadMessageDetailView() {
  const { t } = useTranslation()
  const { canViewPhone } = useOrgRole()
  const { leadId } = Route.useParams()
  const queryClient = useQueryClient()
  const lastMarkedReadRef = useRef<string | null>(null)
  const summary = queryClient.getQueryData<LeadConversation>(['messages', 'lead-conversation-summary', leadId])

  const leadQuery = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api.leads.get(leadId),
    staleTime: 30000,
  })
  const messagesQuery = useQuery({
    queryKey: ['messages', 'lead', leadId],
    queryFn: () => api.leads.messages.listLatest(leadId, { limit: 50 }),
    refetchInterval: FALLBACK_POLLING_INTERVAL,
  })
  const sendMessageMutation = useSendChatMessage({ type: 'lead', leadId }, {
    onSent: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['lead-unread-summary'] })
    },
  })

  const messages = useMemo(() => messagesQuery.data?.messages ?? [], [messagesQuery.data?.messages])
  const displayLead = getDisplayLead(leadQuery.data?.data) ?? getDisplayLead(summary?.lead)
  const latestServerMessageAt = getLatestServerMessageAt(messages)

  useRealtimeMessages({
    context: { type: 'lead', leadId },
    onEvent: (event) => {
      if (event.eventType === 'message.status.updated') {
        queryClient.setQueryData<{ messages: Message[] }>(['messages', 'lead', leadId], (previous) =>
          previous
            ? {
                ...previous,
                messages: previous.messages.map((message) => message.id === event.messageId
                  ? { ...message, twilioStatus: event.twilioStatus }
                  : message),
              }
            : previous
        )
      }
      messagesQuery.refetch().catch(() => undefined)
    },
  })

  useEffect(() => {
    if (!latestServerMessageAt) return

    const readKey = `${leadId}:${latestServerMessageAt}`
    if (lastMarkedReadRef.current === readKey) return
    lastMarkedReadRef.current = readKey

    api.leads.messages.markRead(leadId, { upTo: latestServerMessageAt })
      .then((result) => {
        const previousUnread = summary?.unreadCount ?? 0
        queryClient.setQueryData<LeadConversation>(
          ['messages', 'lead-conversation-summary', leadId],
          (previous) => previous ? { ...previous, unreadCount: result.unreadCount } : previous
        )
        queryClient.setQueryData(['unread-count', 'lead', leadId], result)
        queryClient.setQueryData<{ totalUnread: number }>(['lead-unread-summary'], (previous) =>
          previous
            ? { ...previous, totalUnread: Math.max(0, previous.totalUnread - previousUnread + result.unreadCount) }
            : previous
        )
        queryClient.invalidateQueries({ queryKey: ['lead-unread-summary'] })
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
        queryClient.invalidateQueries({ queryKey: ['leads'] })
        queryClient.invalidateQueries({ queryKey: ['actions'] })
      })
      .catch((error) => {
        lastMarkedReadRef.current = null
        if (import.meta.env.DEV) console.error('Failed to mark lead messages read:', error)
      })
  }, [leadId, latestServerMessageAt, queryClient, summary?.unreadCount])

  const handleSend = async (content: string, channel: 'SMS' | 'PORTAL', attachments: File[] = [], translation?: ComposeTranslationMetadata) => {
    await sendMessageMutation.mutateAsync({ content, channel, attachments, translation })
  }

  const displayName = displayLead?.name || t('leadMessages.unknownLead')
  const avatarColor = displayLead ? getAvatarColor(displayName) : null
  const displayPhone = displayLead?.phone ? canViewPhone ? formatPhone(displayLead.phone) : maskPhone(displayLead.phone) : null
  const hasLoadError = messagesQuery.isError || (!displayLead && leadQuery.isError)

  if (hasLoadError) {
    return (
      <LeadMessageLoadError
        backLabel={t('leadMessages.backToInbox')}
        title={t('leadMessages.loadError')}
        description={t('leadMessages.loadErrorDesc')}
      />
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="flex-shrink-0 bg-card shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/lead-messages" aria-label={t('leadMessages.backToInbox')} className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </Link>

              {displayLead && avatarColor ? (
                <Link to="/leads/$leadId" params={{ leadId }} className="flex items-center gap-3 min-w-0 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors duration-200">
                  <div className={cn('w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ring-2 ring-background', avatarColor.bg, avatarColor.text)}>
                    <span className="text-sm font-medium">{getInitials(displayName)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h1 className="truncate text-sm font-semibold text-foreground tracking-tight">{displayName}</h1>
                      <LeadStatusBadge status={displayLead.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                      {displayPhone && <span>{displayPhone}</span>}
                      {displayLead.campaignTag && <span className="truncate">{displayLead.campaignTag}</span>}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted/60" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-28 bg-muted/60 rounded-md" />
                    <div className="h-3 w-36 bg-muted/40 rounded-md" />
                  </div>
                </div>
              )}
            </div>

            <Link to="/leads/$leadId" params={{ leadId }} className="hidden sm:inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {t('leadMessages.viewProfile')}
            </Link>
          </div>
        </div>
      </header>

      <MessageThread messages={messages} isLoading={messagesQuery.isLoading} className="flex-1 bg-background" />

      {displayLead && (
        <QuickActionsBar
          onSend={handleSend}
          isSending={sendMessageMutation.isPending}
          clientName={displayName}
          clientPhone={displayLead.phone}
          context={{ type: 'lead', leadId }}
          defaultChannel="SMS"
          translationEnabled={false}
          autoFocus
        />
      )}
    </div>
  )
}
