/**
 * Floating Chatbox - Facebook Messenger-style popup chat window
 * Positioned fixed at bottom-right, reuses existing messaging components
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@ella/ui'
import { ChatboxButton } from './chatbox-button'
import { ChatboxHeader } from './chatbox-header'
import { MessageThread } from '../messaging/message-thread'
import { QuickActionsBar } from '../messaging/quick-actions-bar'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

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
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

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
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.')
    },
  })

  // Handle send message - simple function, no memoization needed
  const handleSend = (content: string, channel: 'SMS' | 'PORTAL') => {
    sendMessageMutation.mutate({ content, channel })
  }

  // Handle open/close - simplified without minimize state
  const handleToggle = () => setIsOpen(!isOpen)
  const handleClose = () => setIsOpen(false)

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
          {/* Header - minimize now just closes */}
          <ChatboxHeader
            clientName={clientName}
            clientPhone={clientPhone}
            onMinimize={handleClose}
            onClose={handleClose}
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
    </div>
  )
}
