/**
 * Conversation Detail View - Shows message thread for a specific case
 * Used within the unified inbox split view
 * Includes voice calling integration via Twilio SDK
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ArrowLeft, User, Phone, Globe, RefreshCw, ExternalLink } from 'lucide-react'
import { MessageThread, QuickActionsBar, CallButton, ActiveCallModal } from '../../components/messaging'
import { useVoiceCall } from '../../hooks/use-voice-call'
import { formatPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '../../lib/constants'
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
  const [isSending, setIsSending] = useState(false)
  const [caseData, setCaseData] = useState<{
    client: { id: string; name: string; phone: string; language: Language }
    taxCase: { id: string; taxYear: number; status: TaxCaseStatus }
  } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const prevCaseIdRef = useRef<string>(caseId)

  // Voice call state
  const [voiceState, voiceActions] = useVoiceCall()
  const [showCallModal, setShowCallModal] = useState(false)

  // Fetch messages
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await api.messages.list(caseId)
      // Messages come in desc order from API, reverse for display
      const fetchedMessages = response.messages.reverse()

      // Merge with existing messages to prevent duplicates from optimistic updates
      // Use a Map to dedupe by ID, preferring fetched messages (they have complete data)
      setMessages((prev) => {
        const messageMap = new Map(prev.map((m) => [m.id, m]))
        fetchedMessages.forEach((m) => messageMap.set(m.id, m))
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
      setIsRefreshing(false)
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

  // Handle message send
  const handleSend = useCallback(
    async (content: string, channel: 'SMS' | 'PORTAL') => {
      setIsSending(true)
      try {
        const response = await api.messages.send({ caseId, content, channel })

        // Add new message to list (optimistic update)
        const newMessage: Message = {
          id: response.message.id,
          conversationId: response.message.conversationId,
          channel,
          direction: 'OUTBOUND',
          content,
          createdAt: new Date().toISOString(),
        }

        // Use functional update with deduplication to prevent race condition
        // with polling that may have already fetched this message
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev // Already exists, skip adding
          }
          return [...prev, newMessage]
        })
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to send message:', error)
        }
        // TODO: Show error toast
      } finally {
        setIsSending(false)
      }
    },
    [caseId]
  )

  // Handle refresh
  const handleRefresh = () => {
    fetchMessages(true)
  }

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

  const statusColors = caseData?.taxCase
    ? CASE_STATUS_COLORS[caseData.taxCase.status]
    : undefined

  const avatarColor = caseData ? getAvatarColor(caseData.client.name) : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Back button (mobile) - hidden on desktop */}
              <Link
                to="/messages"
                className="lg:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>

              {/* Client Info */}
              {caseData && avatarColor ? (
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    avatarColor.bg,
                    avatarColor.text
                  )}>
                    <span className="text-sm font-medium">
                      {getInitials(caseData.client.name)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-semibold text-foreground">
                        {caseData.client.name}
                      </h1>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          statusColors?.bg,
                          statusColors?.text
                        )}
                      >
                        {CASE_STATUS_LABELS[caseData.taxCase.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(caseData.client.phone)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {caseData.client.language === 'VI' ? t('messages.languageVi') : t('messages.languageEn')}
                      </span>
                      <span>{caseData.taxCase.taxYear}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Voice Call Button */}
              <CallButton
                isAvailable={voiceState.isAvailable}
                isLoading={voiceState.isLoading}
                callState={voiceState.callState}
                onClick={handleCallClick}
              />
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isRefreshing && 'animate-spin'
                )}
                aria-label={t('messages.refreshMessages')}
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
              {caseData && (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: caseData.client.id }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('messages.viewProfile')}</span>
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
      />

      {/* Quick Actions Bar */}
      {caseData && (
        <QuickActionsBar
          onSend={handleSend}
          isSending={isSending}
          clientName={caseData.client.name}
          clientPhone={caseData.client.phone}
          clientId={caseData.client.id}
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
