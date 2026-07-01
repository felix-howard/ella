/**
 * Floating Chatbox - Facebook Messenger-style popup chat window.
 * Polymorphic: drives case or lead chat via a ChatContext discriminated union.
 * Positioned fixed at bottom-right, reuses existing messaging components.
 * Voice calling (Twilio SDK) available for case context only.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@ella/ui'
import { ChatboxButton } from './chatbox-button'
import { ChatboxHeader } from './chatbox-header'
import { MessageThread } from '../messaging/message-thread'
import { QuickActionsBar } from '../messaging/quick-actions-bar'
import { ActiveCallModal } from '../messaging/active-call-modal'
import { useVoiceCallContext } from '../voice'
import { formatPhone, maskPhone } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'
import { useRealtimeMessages } from '../../hooks/use-realtime-messages'
import { useChatMessages } from '../../hooks/use-chat-messages'
import { useSendChatMessage } from '../../hooks/use-send-chat-message'
import { api } from '../../lib/api-client'
import type { ChatContext } from '../../types/chat-context'
import type {
  ComposeTranslationMetadata,
  Conversation,
  MessagesResponse,
  ReplyMode,
} from '../../lib/api-client'

export interface ChatboxHeaderDescriptor {
  /** Primary line, e.g., client or lead full name. */
  title: string
  /** Optional phone number to display (masked for non-admins). */
  phone?: string
  /** Optional free-form subtitle; takes precedence over `phone` when provided. */
  subtitle?: string
}

export interface FloatingChatboxProps {
  context: ChatContext
  headerProps: ChatboxHeaderDescriptor
  unreadCount: number
  onUnreadChange?: () => void
}

export function FloatingChatbox({
  context,
  headerProps,
  unreadCount,
  onUnreadChange,
}: FloatingChatboxProps) {
  const { canViewPhone } = useOrgRole()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  // Subscribe to realtime events scoped to this context.
  useRealtimeMessages({ context, enabled: isOpen })

  // Voice call state — only meaningful for case context; keep hook mounted so
  // the call modal can render for both types without violating hook ordering.
  const { state: voiceState, actions: voiceActions } = useVoiceCallContext()
  const [showCallModal, setShowCallModal] = useState(false)
  const [isReplyModeSaving, setIsReplyModeSaving] = useState(false)
  const isReplyModeSavingRef = useRef(false)

  const {
    messages,
    conversation,
    isLoading: isLoadingMessages,
  } = useChatMessages(context, isOpen)
  const [replyModeOverride, setReplyModeOverride] = useState<{
    contextId: string
    mode: ReplyMode
  } | null>(null)

  const sendMessageMutation = useSendChatMessage(context, {
    onSent: () => onUnreadChange?.(),
  })

  const replyModeContextId = context.type === 'case' ? context.caseId : null
  const remoteReplyMode = context.type === 'case' ? conversation?.replyMode ?? 'DIRECT' : 'DIRECT'
  const replyMode = replyModeOverride?.contextId === replyModeContextId
    ? replyModeOverride.mode
    : remoteReplyMode
  const canRenderComposer = context.type !== 'case' || !isLoadingMessages

  const handleReplyModeChange = useCallback(async (mode: ReplyMode) => {
    if (context.type !== 'case') return
    if (isReplyModeSavingRef.current || mode === replyMode) return

    const previousMode = replyMode
    const targetContextId = context.caseId
    isReplyModeSavingRef.current = true
    setIsReplyModeSaving(true)
    setReplyModeOverride({ contextId: targetContextId, mode })

    try {
      const response = await api.messages.updateReplyMode(targetContextId, { replyMode: mode })
      queryClient.setQueryData<MessagesResponse>(
        ['messages', 'case', targetContextId],
        (previous) => previous
          ? {
              ...previous,
              conversation: { ...previous.conversation, replyMode: response.replyMode },
            }
          : previous
      )
      queryClient.setQueryData<Conversation>(
        ['messages', 'conversation-summary', targetContextId],
        (previous) => previous ? { ...previous, replyMode: response.replyMode } : previous
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setReplyModeOverride(null)
    } catch (error) {
      setReplyModeOverride({ contextId: targetContextId, mode: previousMode })
      if (import.meta.env.DEV) {
        console.error('Failed to update reply mode:', error)
      }
    } finally {
      isReplyModeSavingRef.current = false
      setIsReplyModeSaving(false)
    }
  }, [context, queryClient, replyMode])

  const handleSend = async (
    content: string,
    channel: 'SMS' | 'PORTAL',
    attachments?: File[],
    translation?: ComposeTranslationMetadata
  ) => {
    await sendMessageMutation.mutateAsync({ content, channel, attachments, translation })
  }

  const handleToggle = () => setIsOpen(!isOpen)
  const handleClose = () => setIsOpen(false)

  const phone = headerProps.phone
  const canCall = context.type === 'case' && !!phone && voiceState.isAvailable

  const handleCallClick = useCallback(() => {
    if (context.type !== 'case' || !phone) return
    setShowCallModal(true)
    voiceActions.initiateCall(phone, context.caseId)
  }, [context, phone, voiceActions])

  // Auto-close call modal when call ends
  useEffect(() => {
    if (voiceState.callState === 'idle' && showCallModal) {
      const timer = setTimeout(() => setShowCallModal(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [voiceState.callState, showCallModal])

  // When chatbox opens on a lead, mark all inbound messages read server-side
  // then refresh the badge. Case context resets unread server-side on list fetch.
  // Clamp via `upTo` = newest rendered message's createdAt so inbound arriving
  // during the round-trip is not silently swallowed.
  const contextType = context.type
  const contextId = context.type === 'lead' ? context.leadId : context.caseId
  const latestMessageAt = messages.length > 0 ? messages[messages.length - 1].createdAt : undefined
  useEffect(() => {
    if (!isOpen) return
    if (contextType === 'lead') {
      api.leads.messages
        .markRead(contextId, latestMessageAt ? { upTo: latestMessageAt } : undefined)
        .catch((err) => console.debug('[chatbox] markRead failed', err))
        .finally(() => onUnreadChange?.())
    } else {
      onUnreadChange?.()
    }
  }, [isOpen, contextType, contextId, latestMessageAt, onUnreadChange])

  // Escape key closes chatbox
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Case-only props for QuickActionsBar's link dropdown.
  const caseClientId = context.type === 'case' ? context.clientId : undefined
  const caseId = context.type === 'case' ? context.caseId : undefined

  return (
    <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-3">
      {/* Chat window - shown when open */}
      {isOpen && (
        <div
          className={cn(
            'w-[360px] min-h-[450px] max-h-[500px] flex flex-col',
            'bg-card rounded-xl shadow-2xl border border-border',
            'animate-in slide-in-from-bottom-4 fade-in duration-200'
          )}
        >
          <ChatboxHeader
            title={headerProps.title}
            phone={phone}
            subtitle={headerProps.subtitle}
            onClose={handleClose}
            onCall={canCall ? handleCallClick : undefined}
          />

          <MessageThread
            messages={messages}
            isLoading={isLoadingMessages}
            className="flex-1 min-h-[320px] bg-background"
          />

          {canRenderComposer && (
            <QuickActionsBar
              onSend={handleSend}
              isSending={sendMessageMutation.isPending}
              clientName={headerProps.title}
              clientPhone={phone}
              clientId={caseClientId}
              caseId={caseId}
              context={context}
              replyMode={replyMode}
              onReplyModeChange={context.type === 'case' ? handleReplyModeChange : undefined}
              isReplyModeSaving={isReplyModeSaving}
              translationEnabled={context.type === 'case'}
              autoFocus
            />
          )}
        </div>
      )}

      {/* Floating button - always visible */}
      <ChatboxButton
        unreadCount={unreadCount}
        isOpen={isOpen}
        onClick={handleToggle}
        className="relative"
      />

      {/* Active Call Modal - case context only */}
      {showCallModal && context.type === 'case' && phone && (
        <ActiveCallModal
          isOpen={showCallModal}
          callState={voiceState.callState}
          isMuted={voiceState.isMuted}
          duration={voiceState.duration}
          clientName={headerProps.title}
          clientPhone={canViewPhone ? formatPhone(phone) : maskPhone(phone)}
          error={voiceState.error}
          onEndCall={voiceActions.endCall}
          onToggleMute={voiceActions.toggleMute}
          onClose={() => setShowCallModal(false)}
        />
      )}
    </div>
  )
}
