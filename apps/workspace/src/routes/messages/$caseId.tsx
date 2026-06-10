/**
 * Conversation Detail View - Shows message thread for a specific case
 * Used within the unified inbox split view
 * Includes voice calling integration via Twilio SDK
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ArrowLeft } from 'lucide-react'
import { MessageThread, QuickActionsBar, CallButton, ActiveCallModal } from '../../components/messaging'
import { useVoiceCall } from '../../hooks/use-voice-call'
import { useRealtimeMessages } from '../../hooks/use-realtime-messages'
import { formatPhone, maskPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'
import { api } from '../../lib/api-client'
import type { Message, TaxCaseStatus, Language } from '../../lib/api-client'

export const Route = createFileRoute('/messages/$caseId')({
  component: ConversationDetailView,
})

// Fallback polling interval (60 seconds — realtime handles instant updates)
const FALLBACK_POLLING_INTERVAL = 60000
const OPTIMISTIC_MATCH_WINDOW_MS = 60000

type LocalMessage = Message & {
  _optimistic?: 'sending' | 'failed'
  _attachmentFiles?: File[]
}

function isLikelyServerCopy(optimistic: LocalMessage, message: Message): boolean {
  if (!optimistic.id.startsWith('temp-') || message.id.startsWith('temp-')) return false
  if (message.direction !== optimistic.direction || message.channel !== optimistic.channel) return false
  if (message.content !== optimistic.content) return false

  const optimisticAttachmentCount = optimistic.attachmentUrls?.length ?? 0
  const messageAttachmentCount = message.attachmentUrls?.length ?? 0
  if (optimisticAttachmentCount !== messageAttachmentCount) return false

  const optimisticTime = new Date(optimistic.createdAt).getTime()
  const messageTime = new Date(message.createdAt).getTime()
  return messageTime >= optimisticTime - 1000 && messageTime <= optimisticTime + OPTIMISTIC_MATCH_WINDOW_MS
}

function dedupeMessagesById(messages: LocalMessage[]): LocalMessage[] {
  return Array.from(new Map(messages.map((message) => [message.id, message])).values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function ConversationDetailView() {
  const { t } = useTranslation()
  const { canViewPhone } = useOrgRole()
  const { caseId } = Route.useParams()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [caseData, setCaseData] = useState<{
    client: { id: string; name: string; phone: string; language: Language }
    taxCase: { id: string; taxYear: number; status: TaxCaseStatus }
  } | null>(null)
  const prevCaseIdRef = useRef<string>(caseId)
  const currentCaseIdRef = useRef<string>(caseId)
  const isSendingMessageRef = useRef(false)
  const optimisticPreviewUrlsRef = useRef<Set<string>>(new Set())
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

  // Fetch messages
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)

    try {
      const response = await api.messages.list(caseId)
      // Messages come in desc order from API, reverse for display
      const fetchedMessages = response.messages.reverse()

      // Merge fetched messages with existing, keeping optimistic (temp-*) messages
      setMessages((prev) => {
        // Keep optimistic messages that are still pending
        const optimisticMessages = prev.filter((m) => {
          if (!m.id.startsWith('temp-')) return false
          if (!fetchedMessages.some((message) => isLikelyServerCopy(m, message))) return true
          revokeOptimisticPreviewUrls(m.attachmentUrls)
          return false
        })
        const messageMap = new Map(fetchedMessages.map((m) => [m.id, m]))
        // Add back optimistic messages (they'll be replaced when API responds)
        optimisticMessages.forEach((m) => messageMap.set(m.id, m))
        return Array.from(messageMap.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch messages:', error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [caseId, revokeOptimisticPreviewUrls])

  // Fetch case data for header
  const fetchCaseData = useCallback(async () => {
    try {
      const caseDetail = await api.cases.get(caseId)
      setCaseData({
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
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to fetch case data:', error)
      }
    }
  }, [caseId])

  // Subscribe to realtime message events — refetch messages on new events
  useRealtimeMessages({
    caseId,
    onEvent: () => fetchMessages(true),
  })

  // Initial fetch and reset when case changes
  useEffect(() => {
    if (prevCaseIdRef.current !== caseId) {
      // Reset state when navigating to different conversation
      revokeAllOptimisticPreviewUrls()
      setMessages([])
      setIsLoading(true)
      setCaseData(null)
      prevCaseIdRef.current = caseId
    }
    fetchMessages()
    fetchCaseData()
  }, [caseId, fetchMessages, fetchCaseData, revokeAllOptimisticPreviewUrls])

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
      setMessages((prev) => [...prev, optimisticMessage])

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
        setMessages((prev) =>
          dedupeMessagesById([
            ...prev.filter((m) => m.id !== tempId && m.id !== response.message.id),
            confirmedMessage,
          ])
        )
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
        setMessages((prev) => {
          const hasServerCopy = prev.some((m) => isLikelyServerCopy(optimisticMessage, m))
          if (hasServerCopy) {
            revokeOptimisticPreviewUrls(attachmentUrls)
            return prev.filter((m) => m.id !== tempId)
          }
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
    [caseId, queryClient, revokeOptimisticPreviewUrls]
  )

  // Retry a failed optimistic message
  const handleRetry = useCallback(
    (failedMessage: LocalMessage) => {
      // Remove the failed message and re-send
      setMessages((prev) => prev.filter((m) => m.id !== failedMessage.id))
      revokeOptimisticPreviewUrls(failedMessage.attachmentUrls)
      handleSend(
        failedMessage.content,
        failedMessage.channel as 'SMS' | 'PORTAL',
        failedMessage._attachmentFiles ?? []
      ).catch(() => undefined)
    },
    [handleSend, revokeOptimisticPreviewUrls]
  )

  // Handle call button click
  const handleCallClick = useCallback(() => {
    if (caseData?.client.phone) {
      setShowCallModal(true)
      voiceActions.initiateCall(caseData.client.phone, caseId)
    }
  }, [caseData, caseId, voiceActions])

  // Auto-close modal when call ends
  useEffect(() => {
    if (voiceState.callState === 'idle' && showCallModal) {
      // Delay close to show completion state
      const timer = setTimeout(() => setShowCallModal(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [voiceState.callState, showCallModal])

  const avatarColor = caseData ? getAvatarColor(caseData.client.name) : null

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
              {caseData && avatarColor ? (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: caseData.client.id }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-muted/60 transition-colors duration-200 cursor-pointer"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shadow-sm ring-2 ring-background',
                    avatarColor.bg,
                    avatarColor.text
                  )}>
                    <span className="text-sm font-medium">
                      {getInitials(caseData.client.name)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 min-w-0">
                      <h1 className="text-sm font-semibold text-foreground truncate tracking-tight">
                        {caseData.client.name}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                      <span>{canViewPhone ? formatPhone(caseData.client.phone) : maskPhone(caseData.client.phone)}</span>
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
      {caseData && (
        <QuickActionsBar
          onSend={handleSend}
          clientName={caseData.client.name}
          clientPhone={caseData.client.phone}
          clientId={caseData.client.id}
          caseId={caseId}
          defaultChannel="SMS"
          isSending={isSendingMessage}
        />
      )}

      {/* Active Call Modal */}
      {showCallModal && caseData && (
        <ActiveCallModal
          isOpen={showCallModal}
          callState={voiceState.callState}
          isMuted={voiceState.isMuted}
          duration={voiceState.duration}
          clientName={caseData.client.name}
          clientPhone={canViewPhone ? formatPhone(caseData.client.phone) : maskPhone(caseData.client.phone)}
          error={voiceState.error}
          onEndCall={voiceActions.endCall}
          onToggleMute={voiceActions.toggleMute}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}
