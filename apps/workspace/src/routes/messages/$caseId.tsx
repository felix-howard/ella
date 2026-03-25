/**
 * Conversation Detail View - Shows message thread for a specific case
 * Used within the unified inbox split view
 * Includes voice calling integration via Twilio SDK
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ArrowLeft, User, ExternalLink } from 'lucide-react'
import { MessageThread, QuickActionsBar, CallButton, ActiveCallModal } from '../../components/messaging'
import { useVoiceCall } from '../../hooks/use-voice-call'
import { formatPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { api } from '../../lib/api-client'
import type { Message, TaxCaseStatus, Language } from '../../lib/api-client'

export const Route = createFileRoute('/messages/$caseId')({
  component: ConversationDetailView,
})

// Polling interval (10 seconds for active conversation)
const POLLING_INTERVAL = 10000

function ConversationDetailView() {
  const { t } = useTranslation()
  const { caseId } = Route.useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [caseData, setCaseData] = useState<{
    client: { id: string; name: string; phone: string; language: Language }
    taxCase: { id: string; taxYear: number; status: TaxCaseStatus }
  } | null>(null)
  const prevCaseIdRef = useRef<string>(caseId)

  // Voice call state
  const [voiceState, voiceActions] = useVoiceCall()
  const [showCallModal, setShowCallModal] = useState(false)

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
        const optimisticMessages = prev.filter((m) => m.id.startsWith('temp-'))
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
  }, [caseId])

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

  // Initial fetch and reset when case changes
  useEffect(() => {
    if (prevCaseIdRef.current !== caseId) {
      // Reset state when navigating to different conversation
      setMessages([])
      setIsLoading(true)
      setCaseData(null)
      prevCaseIdRef.current = caseId
    }
    fetchMessages()
    fetchCaseData()
  }, [caseId, fetchMessages, fetchCaseData])

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages(true)
    }, POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchMessages])

  // Handle message send with true optimistic update
  const handleSend = useCallback(
    async (content: string, channel: 'SMS' | 'PORTAL') => {
      // Generate a temporary ID and show the message immediately
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const optimisticMessage: Message & { _optimistic?: 'sending' | 'failed' } = {
        id: tempId,
        conversationId: caseId,
        channel,
        direction: 'OUTBOUND',
        content,
        createdAt: new Date().toISOString(),
        _optimistic: 'sending',
      }

      // Show message in UI instantly
      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const response = await api.messages.send({ caseId, content, channel })

        // Replace temp message with real server data
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...response.message, channel, direction: 'OUTBOUND' as const, content, createdAt: response.message.createdAt || optimisticMessage.createdAt }
              : m
          )
        )
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to send message:', error)
        }
        // Mark as failed so user can retry
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _optimistic: 'failed' } : m
          )
        )
      }
    },
    [caseId]
  )

  // Retry a failed optimistic message
  const handleRetry = useCallback(
    (failedMessage: Message & { _optimistic?: string }) => {
      // Remove the failed message and re-send
      setMessages((prev) => prev.filter((m) => m.id !== failedMessage.id))
      handleSend(failedMessage.content, failedMessage.channel as 'SMS' | 'PORTAL')
    },
    [handleSend]
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

              {/* Client Info */}
              {caseData && avatarColor ? (
                <div className="flex items-center gap-3">
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
                      <span>{formatPhone(caseData.client.phone)}</span>
                    </div>
                  </div>
                </div>
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
              {caseData && (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: caseData.client.id }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground bg-muted border border-border shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-muted/80 hover:shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-all duration-200"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{t('messages.viewProfile')}</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
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
          clientPhone={formatPhone(caseData.client.phone)}
          error={voiceState.error}
          onEndCall={voiceActions.endCall}
          onToggleMute={voiceActions.toggleMute}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}
