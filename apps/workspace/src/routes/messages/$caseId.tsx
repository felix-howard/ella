/**
 * Conversation Detail View - Shows message thread for a specific case
 * Used within the unified inbox split view
 * Includes voice calling integration via Twilio SDK
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ArrowLeft } from 'lucide-react'
import { MessageThread, QuickActionsBar, CallButton, ActiveCallModal } from '../../components/messaging'
import { useVoiceCall } from '../../hooks/use-voice-call'
import { getMessageEventType, useRealtimeMessages } from '../../hooks/use-realtime-messages'
import { formatPhone, maskPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'
import { api } from '../../lib/api-client'
import { dedupeMessagesById, mergeFetchedMessages } from '../../lib/optimistic-message-merge'
import type { Conversation, TaxCaseStatus, Language } from '../../lib/api-client'
import type { OptimisticMessage } from '../../lib/optimistic-message-merge'

export const Route = createFileRoute('/messages/$caseId')({
  component: ConversationDetailView,
})

// Fallback polling interval (60 seconds — realtime handles instant updates)
const FALLBACK_POLLING_INTERVAL = 60000
type LocalMessage = OptimisticMessage
type CaseData = {
  client: { id: string; name: string; phone: string; language: Language }
  taxCase: { id: string; taxYear: number; status: TaxCaseStatus }
}

function getCaseDataFromConversation(conversation: Conversation): CaseData {
  return {
    client: {
      id: conversation.client.id,
      name: conversation.client.name,
      phone: conversation.client.phone,
      language: conversation.client.language,
    },
    taxCase: {
      id: conversation.taxCase.id,
      taxYear: conversation.taxCase.taxYear,
      status: conversation.taxCase.status,
    },
  }
}

function ConversationDetailView() {
  const { t } = useTranslation()
  const { canViewPhone } = useOrgRole()
  const { caseId } = Route.useParams()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const prevCaseIdRef = useRef<string>(caseId)
  const currentCaseIdRef = useRef<string>(caseId)
  const isSendingMessageRef = useRef(false)
  const optimisticPreviewUrlsRef = useRef<Set<string>>(new Set())
  const lastMarkedReadRef = useRef<string | null>(null)
  const messagesCacheRef = useRef<Map<string, LocalMessage[]>>(new Map())
  const caseDataCacheRef = useRef<Map<string, CaseData>>(new Map())
  currentCaseIdRef.current = caseId

  // Voice call state
  const [voiceState, voiceActions] = useVoiceCall()
  const [showCallModal, setShowCallModal] = useState(false)

  const revokeOptimisticPreviewUrls = useCallback((urls?: string[]) => {
    urls?.forEach((url) => {
      if (!url.startsWith('blob:')) return
      URL.revokeObjectURL(url)
      optimisticPreviewUrlsRef.current.delete(url)
    })
  }, [])

  const revokeAllOptimisticPreviewUrls = useCallback(() => {
    optimisticPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    optimisticPreviewUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    return () => {
      revokeAllOptimisticPreviewUrls()
    }
  }, [revokeAllOptimisticPreviewUrls])

  const setCurrentMessages = useCallback((updater: (prev: LocalMessage[]) => LocalMessage[]) => {
    setMessages((prev) => {
      const nextMessages = updater(prev)
      messagesCacheRef.current.set(currentCaseIdRef.current, nextMessages)
      return nextMessages
    })
  }, [])

  const getCachedCaseData = useCallback((targetCaseId: string): CaseData | null => {
    const conversation = queryClient.getQueryData<Conversation>([
      'messages',
      'conversation-summary',
      targetCaseId,
    ])
    return conversation ? getCaseDataFromConversation(conversation) : null
  }, [queryClient])

  const markLatestRenderedRead = useCallback((latestRenderedAt?: string) => {
    if (!latestRenderedAt) return

    const readKey = `${caseId}:${latestRenderedAt}`
    if (lastMarkedReadRef.current === readKey) return
    lastMarkedReadRef.current = readKey

    api.messages.markRead(caseId, { upTo: latestRenderedAt })
      .then((result) => {
        queryClient.setQueryData(['unread-count', 'case', caseId], {
          unreadCount: result.unreadCount,
        })
        queryClient.invalidateQueries({ queryKey: ['unread-count'] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .catch((error) => {
        lastMarkedReadRef.current = null
        if (import.meta.env.DEV) {
          console.error('Failed to mark conversation read:', error)
        }
      })
  }, [caseId, queryClient])

  // Fetch messages
  const fetchMessages = useCallback(async (silent = false) => {
    const requestCaseId = caseId
    const hasCachedMessages = messagesCacheRef.current.has(requestCaseId)
    if (!silent && !hasCachedMessages) setIsLoading(true)

    try {
      const response = await api.messages.list(requestCaseId)
      if (currentCaseIdRef.current !== requestCaseId) return

      // Messages come in desc order from API, reverse for display
      const fetchedMessages = response.messages.reverse()
      const latestRenderedAt = fetchedMessages[fetchedMessages.length - 1]?.createdAt

      // Merge fetched messages with existing, keeping optimistic (temp-*) messages
      setCurrentMessages((prev) => {
        return mergeFetchedMessages(prev, fetchedMessages, revokeOptimisticPreviewUrls)
      })
      markLatestRenderedRead(latestRenderedAt)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch messages:', error)
      }
    } finally {
      if (currentCaseIdRef.current === requestCaseId) {
        setIsLoading(false)
      }
    }
  }, [caseId, markLatestRenderedRead, revokeOptimisticPreviewUrls, setCurrentMessages])

  // Fetch case data for header
  const fetchCaseData = useCallback(async () => {
    const requestCaseId = caseId
    try {
      const caseDetail = await api.cases.get(requestCaseId)
      if (currentCaseIdRef.current !== requestCaseId) return

      const nextCaseData = {
        client: {
          id: caseDetail.client.id,
          name: caseDetail.client.name,
          phone: caseDetail.client.phone,
          language: caseDetail.client.language,
        },
        taxCase: {
          id: caseDetail.id,
          taxYear: caseDetail.taxYear,
          status: caseDetail.status,
        },
      }
      caseDataCacheRef.current.set(requestCaseId, nextCaseData)
      setCaseData(nextCaseData)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch case data:', error)
      }
    }
  }, [caseId])

  // Subscribe to realtime message events — patch status immediately, then reconcile.
  useRealtimeMessages({
    caseId,
    onEvent: (event) => {
      const eventType = getMessageEventType(event)

      if (event.eventType === 'message.status.updated') {
        setCurrentMessages((prev) =>
          prev.map((message) =>
            message.id === event.messageId
              ? { ...message, twilioStatus: event.twilioStatus }
              : message
          )
        )
      }

      if (eventType === 'message.created' || eventType === 'message.status.updated') {
        void fetchMessages(true)
      }
    },
  })

  // Initial fetch and reset when case changes
  useEffect(() => {
    if (prevCaseIdRef.current !== caseId) {
      revokeAllOptimisticPreviewUrls()
      const cachedMessages = messagesCacheRef.current.get(caseId)
      const cachedCaseData = caseDataCacheRef.current.get(caseId) ?? getCachedCaseData(caseId)

      setMessages(cachedMessages ?? [])
      setIsLoading(!cachedMessages)
      setCaseData(cachedCaseData ?? null)
      lastMarkedReadRef.current = null
      prevCaseIdRef.current = caseId
    }
    fetchMessages()
    fetchCaseData()
  }, [caseId, fetchMessages, fetchCaseData, getCachedCaseData, revokeAllOptimisticPreviewUrls])

  // Fallback polling (realtime handles instant updates)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages(true)
    }, FALLBACK_POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchMessages])

  // Handle message send with true optimistic update
  const handleSend = useCallback(
    async (content: string, channel: 'SMS' | 'PORTAL', attachments: File[] = []) => {
      if (isSendingMessageRef.current) {
        throw new Error('Message send already in progress')
      }
      isSendingMessageRef.current = true
      setIsSendingMessage(true)
      const sendCaseId = caseId

      // Generate a temporary ID and show the message immediately
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const attachmentUrls = attachments.map((file) => {
        const url = URL.createObjectURL(file)
        optimisticPreviewUrlsRef.current.add(url)
        return url
      })
      const optimisticMessage: LocalMessage = {
        id: tempId,
        conversationId: caseId,
        channel,
        direction: 'OUTBOUND',
        content,
        attachmentUrls,
        createdAt: new Date().toISOString(),
        _optimistic: 'sending',
        _attachmentFiles: attachments.length > 0 ? attachments : undefined,
      }

      // Show message in UI instantly
      setCurrentMessages((prev) => [...prev, optimisticMessage])

      try {
        const response = attachments.length > 0
          ? await api.messages.sendWithAttachments({ caseId: sendCaseId, content, images: attachments })
          : await api.messages.send({ caseId: sendCaseId, content, channel })
        if (currentCaseIdRef.current !== sendCaseId) {
          revokeOptimisticPreviewUrls(attachmentUrls)
          return
        }

        const confirmedMessage: LocalMessage = {
          ...response.message,
          channel,
          direction: 'OUTBOUND',
          content,
          createdAt: response.message.createdAt || optimisticMessage.createdAt,
        }

        // Replace temp message with real server data
        setCurrentMessages((prev) => {
          return dedupeMessagesById([
            ...prev.filter((m) => m.id !== tempId && m.id !== response.message.id),
            confirmedMessage,
          ])
        })
        revokeOptimisticPreviewUrls(attachmentUrls)
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to send message:', error)
        }
        if (currentCaseIdRef.current !== sendCaseId) {
          revokeOptimisticPreviewUrls(attachmentUrls)
          return
        }

        // Mark as failed so user can retry
        setCurrentMessages((prev) => {
          return prev.map((m) =>
            m.id === tempId ? { ...m, _optimistic: 'failed' } : m
          )
        })
        throw error
      } finally {
        isSendingMessageRef.current = false
        setIsSendingMessage(false)
      }
    },
    [caseId, queryClient, revokeOptimisticPreviewUrls, setCurrentMessages]
  )

  // Retry a failed optimistic message
  const handleRetry = useCallback(
    (failedMessage: LocalMessage) => {
      // Remove the failed message and re-send
      setCurrentMessages((prev) => prev.filter((m) => m.id !== failedMessage.id))
      revokeOptimisticPreviewUrls(failedMessage.attachmentUrls)
      handleSend(
        failedMessage.content,
        failedMessage.channel as 'SMS' | 'PORTAL',
        failedMessage._attachmentFiles ?? []
      ).catch(() => undefined)
    },
    [handleSend, revokeOptimisticPreviewUrls, setCurrentMessages]
  )

  // Handle call button click
  const displayCaseData = useMemo(() => {
    if (caseData?.taxCase.id === caseId) return caseData
    return getCachedCaseData(caseId)
  }, [caseData, caseId, getCachedCaseData])

  const handleCallClick = useCallback(() => {
    if (displayCaseData?.client.phone) {
      setShowCallModal(true)
      voiceActions.initiateCall(displayCaseData.client.phone, caseId)
    }
  }, [displayCaseData, caseId, voiceActions])

  // Auto-close modal when call ends
  useEffect(() => {
    if (voiceState.callState === 'idle' && showCallModal) {
      // Delay close to show completion state
      const timer = setTimeout(() => setShowCallModal(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [voiceState.callState, showCallModal])

  const avatarColor = displayCaseData ? getAvatarColor(displayCaseData.client.name) : null

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <header className="flex-shrink-0 bg-card shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Back button (mobile) - hidden on md+ desktop */}
              <Link
                to="/messages"
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              {/* Client Info - clickable to navigate to profile */}
              {displayCaseData && avatarColor ? (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: displayCaseData.client.id }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors duration-200 cursor-pointer"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shadow-sm ring-2 ring-background',
                    avatarColor.bg,
                    avatarColor.text
                  )}>
                    <span className="text-sm font-medium">
                      {getInitials(displayCaseData.client.name)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 min-w-0">
                      <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
                        {displayCaseData.client.name}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                      <span>{canViewPhone ? formatPhone(displayCaseData.client.phone) : maskPhone(displayCaseData.client.phone)}</span>
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

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Voice Call Button */}
              <CallButton
                isAvailable={voiceState.isAvailable}
                isLoading={voiceState.isLoading}
                callState={voiceState.callState}
                onClick={handleCallClick}
                label={t('messages.call')}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Message Thread */}
      <MessageThread
        messages={messages}
        isLoading={isLoading}
        className="flex-1 bg-background"
        onRetry={handleRetry}
      />

      {/* Quick Actions Bar */}
      {displayCaseData && (
        <QuickActionsBar
          onSend={handleSend}
          clientName={displayCaseData.client.name}
          clientPhone={displayCaseData.client.phone}
          clientId={displayCaseData.client.id}
          caseId={caseId}
          defaultChannel="SMS"
          isSending={isSendingMessage}
        />
      )}

      {/* Active Call Modal */}
      {showCallModal && displayCaseData && (
        <ActiveCallModal
          isOpen={showCallModal}
          callState={voiceState.callState}
          isMuted={voiceState.isMuted}
          duration={voiceState.duration}
          clientName={displayCaseData.client.name}
          clientPhone={canViewPhone ? formatPhone(displayCaseData.client.phone) : maskPhone(displayCaseData.client.phone)}
          error={voiceState.error}
          onEndCall={voiceActions.endCall}
          onToggleMute={voiceActions.toggleMute}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}
