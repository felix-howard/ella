/**
 * Floating Chatbox - Facebook Messenger-style popup chat window
 * Positioned fixed at bottom-right, reuses existing messaging components
 * Includes voice calling integration via Twilio SDK
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ChatboxButton } from './chatbox-button'
import { ChatboxHeader } from './chatbox-header'
import { MessageThread } from '../messaging/message-thread'
import { QuickActionsBar } from '../messaging/quick-actions-bar'
import { ActiveCallModal } from '../messaging/active-call-modal'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useVoiceCall } from '../../hooks/use-voice-call'
import { formatPhone } from '../../lib/formatters'

// Constants for configuration
const POLLING_INTERVAL_MS = 15000 // 15 seconds - balanced between real-time and performance

export interface FloatingChatboxProps {
  caseId: string
  clientName: string
  clientPhone?: string
  clientId: string
  unreadCount: number
  onUnreadChange?: () => void
}

export function FloatingChatbox({
  caseId,
  clientName,
  clientPhone,
  clientId,
  unreadCount,
  onUnreadChange,
}: FloatingChatboxProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  // Voice call state
  const [voiceState, voiceActions] = useVoiceCall()
  const [showCallModal, setShowCallModal] = useState(false)

  // Fetch messages using consistent query key with full messages page
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['messages', caseId],
    queryFn: () => api.messages.list(caseId),
    enabled: isOpen && !!caseId,
    refetchInterval: isOpen ? POLLING_INTERVAL_MS : false,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; channel: 'SMS' | 'PORTAL' }) =>
      api.messages.send({ caseId, ...data }),
    onSuccess: () => {
      // Refetch messages after sending
      queryClient.invalidateQueries({ queryKey: ['messages', caseId] })
      // Update unread count in parent (debounced in parent)
      onUnreadChange?.()
    },
    onError: () => {
      toast.error(t('chat.sendError'))
    },
  })

  // Handle send message - simple function, no memoization needed
  const handleSend = (content: string, channel: 'SMS' | 'PORTAL') => {
    sendMessageMutation.mutate({ content, channel })
  }

  // Handle open/close - simplified without minimize state
  const handleToggle = () => setIsOpen(!isOpen)
  const handleClose = () => setIsOpen(false)

  // Handle call button click - uses Twilio voice calling
  const handleCallClick = useCallback(() => {
    if (clientPhone) {
      setShowCallModal(true)
      voiceActions.initiateCall(clientPhone, caseId)
    }
  }, [clientPhone, caseId, voiceActions])

  // Auto-close call modal when call ends
  useEffect(() => {
    if (voiceState.callState === 'idle' && showCallModal) {
      // Delay close to show completion state
      const timer = setTimeout(() => setShowCallModal(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [voiceState.callState, showCallModal])

  // When chatbox opens, trigger unread count refresh
  useEffect(() => {
    if (isOpen) {
      onUnreadChange?.()
    }
  }, [isOpen, onUnreadChange])

  // Escape key handler for accessibility
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const messages = messagesData?.messages ?? []

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window - shown when open */}
      {isOpen && (
        <div
          className={cn(
            'w-[360px] max-h-[500px] flex flex-col',
            'bg-card rounded-xl shadow-2xl border border-border',
            'animate-in slide-in-from-bottom-4 fade-in duration-200'
          )}
        >
          {/* Header with call and close buttons */}
          <ChatboxHeader
            clientName={clientName}
            clientPhone={clientPhone}
            onClose={handleClose}
            onCall={clientPhone && voiceState.isAvailable ? handleCallClick : undefined}
          />

          {/* Message thread */}
          <MessageThread
            messages={messages}
            isLoading={isLoadingMessages}
            className="h-[320px] bg-background"
          />

          {/* Quick actions / composer */}
          <QuickActionsBar
            onSend={handleSend}
            isSending={sendMessageMutation.isPending}
            clientName={clientName}
            clientPhone={clientPhone}
            clientId={clientId}
            autoFocus
          />
        </div>
      )}

      {/* Floating button - always visible */}
      <ChatboxButton
        unreadCount={unreadCount}
        isOpen={isOpen}
        onClick={handleToggle}
        className="relative"
      />

      {/* Active Call Modal */}
      {showCallModal && clientPhone && (
        <ActiveCallModal
          isOpen={showCallModal}
          callState={voiceState.callState}
          isMuted={voiceState.isMuted}
          duration={voiceState.duration}
          clientName={clientName}
          clientPhone={formatPhone(clientPhone)}
          error={voiceState.error}
          onEndCall={voiceActions.endCall}
          onToggleMute={voiceActions.toggleMute}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}
