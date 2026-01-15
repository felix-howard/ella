/**
 * Client Messages Tab - Shows message thread for client's latest tax case
 * Used within Client Detail page's "Tin nhắn" tab
 * SMS-only mode (no channel switcher needed)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, RefreshCw, MessageSquare } from 'lucide-react'
import { MessageThread, QuickActionsBar } from '../messaging'
import { api, type Message } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

// Polling interval (10 seconds for active tab)
const POLLING_INTERVAL = 10000

export interface ClientMessagesTabProps {
  clientId: string
  caseId: string | undefined
  clientName: string
  clientPhone: string
  isActive: boolean // Only poll when tab is active
}

export function ClientMessagesTab({
  caseId,
  clientName,
  clientPhone,
  isActive,
}: ClientMessagesTabProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track fetch request ID to prevent race conditions
  const fetchIdRef = useRef(0)
  const isFetchingRef = useRef(false)

  // Fetch messages for the case with race condition protection
  const fetchMessages = useCallback(async (silent = false) => {
    if (!caseId) return

    // Prevent concurrent fetches (race condition fix)
    if (isFetchingRef.current && silent) return
    isFetchingRef.current = true

    const currentFetchId = ++fetchIdRef.current
    if (!silent) setIsLoading(true)
    setError(null)

    try {
      const response = await api.messages.list(caseId)

      // Ignore stale responses (race condition fix)
      if (currentFetchId !== fetchIdRef.current) return

      // Messages come in desc order from API, reverse for display
      setMessages(response.messages.reverse())
    } catch (err) {
      // Ignore errors from stale requests
      if (currentFetchId !== fetchIdRef.current) return

      const errorMsg = err instanceof Error ? err.message : 'Không thể tải tin nhắn'
      setError(errorMsg)
      if (import.meta.env.DEV) {
        console.error('Failed to fetch messages:', err)
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [caseId])

  // Initial fetch and reset when caseId changes
  useEffect(() => {
    // Reset state on caseId change
    setMessages([])
    setError(null)
    fetchIdRef.current++ // Invalidate any in-flight requests

    if (caseId) {
      setIsLoading(true)
      fetchMessages()
    } else {
      setIsLoading(false)
    }
  }, [caseId, fetchMessages])

  // Polling for real-time updates (only when tab is active)
  useEffect(() => {
    if (!isActive || !caseId) return

    const interval = setInterval(() => {
      fetchMessages(true)
    }, POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [isActive, caseId, fetchMessages])

  // Handle message send (SMS only)
  const handleSend = useCallback(
    async (content: string) => {
      if (!caseId) return

      setIsSending(true)
      try {
        const response = await api.messages.send({ caseId, content, channel: 'SMS' })

        // Optimistic update - add new message to list
        const newMessage: Message = {
          id: response.message.id,
          conversationId: response.message.conversationId,
          channel: 'SMS',
          direction: 'OUTBOUND',
          content,
          createdAt: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, newMessage])

        // Show info toast if SMS delivery failed but message saved
        if (!response.sent) {
          toast.info(response.error || 'Tin nhắn đã lưu nhưng không thể gửi SMS')
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Không thể gửi tin nhắn'
        toast.error(errorMsg)
        if (import.meta.env.DEV) {
          console.error('Failed to send message:', err)
        }
      } finally {
        setIsSending(false)
      }
    },
    [caseId]
  )

  // Wrapper to adapt QuickActionsBar's onSend signature
  const handleQuickActionsSend = useCallback(
    (content: string, _channel: 'SMS' | 'PORTAL') => {
      // Always send as SMS, ignore channel parameter
      handleSend(content)
    },
    [handleSend]
  )

  // Handle retry
  const handleRetry = () => {
    fetchMessages()
  }

  // No tax case - show empty state
  if (!caseId) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h3 className="font-medium text-foreground mb-1">Chưa có hồ sơ thuế</h3>
          <p className="text-sm text-muted-foreground">
            Tạo hồ sơ thuế để bắt đầu nhắn tin với khách hàng
          </p>
        </div>
      </div>
    )
  }

  // Error state with retry
  if (error && !isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" aria-hidden="true" />
          <h3 className="font-medium text-foreground mb-1">Không thể tải tin nhắn</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex flex-col h-[500px]">
        {/* Message Thread */}
        <MessageThread
          messages={messages}
          isLoading={isLoading}
          className="flex-1"
        />

        {/* Quick Actions Bar (SMS-only mode) */}
        <QuickActionsBar
          onSend={handleQuickActionsSend}
          isSending={isSending}
          clientName={clientName}
          clientPhone={clientPhone}
          defaultChannel="SMS"
        />
      </div>
    </div>
  )
}
