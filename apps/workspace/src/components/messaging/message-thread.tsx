/**
 * Message Thread - Displays conversation history with auto-scroll
 * Renders messages in chronological order with date separators
 */

import { useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { MessageSquare } from 'lucide-react'
import { MessageBubble, TypingIndicator } from './message-bubble'
import type { Message } from '../../lib/api-client'

export interface MessageThreadProps {
  messages: Message[]
  isLoading?: boolean
  isTyping?: boolean
  className?: string
}

export function MessageThread({
  messages,
  isLoading,
  isTyping,
  className,
}: MessageThreadProps) {
  const { t, i18n } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const hasScrolledInitialRef = useRef(false)

  // Group messages by date for date separators (sorted oldest first)
  const groupedMessages = useMemo(() => {
    // Sort messages by createdAt ascending (oldest first)
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''

    const dateLocale = i18n.language === 'vi' ? 'vi-VN' : 'en-US'
    sortedMessages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toLocaleDateString(dateLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })

      if (messageDate !== currentDate) {
        currentDate = messageDate
        groups.push({ date: messageDate, messages: [message] })
      } else {
        groups[groups.length - 1].messages.push(message)
      }
    })

    return groups
  }, [messages, i18n.language])

  // Reset scroll state when messages are cleared (e.g., navigating between conversations)
  useEffect(() => {
    if (messages.length === 0) {
      hasScrolledInitialRef.current = false
      prevMessagesLengthRef.current = 0
    }
  }, [messages.length])

  // Scroll to bottom - handles both initial load and new messages
  useEffect(() => {
    if (messages.length === 0) return

    const scrollToBottom = (instant: boolean) => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
      }
    }

    // Initial load - use requestAnimationFrame to ensure DOM is ready
    if (!hasScrolledInitialRef.current) {
      // Double RAF ensures layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(true)
          hasScrolledInitialRef.current = true
          prevMessagesLengthRef.current = messages.length
        })
      })
      return
    }

    // New messages added - smooth scroll
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom(false)
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">{t('messages.loading')}</p>
        </div>
      </div>
    )
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">{t('messages.noMessages')}</p>
          <p className="text-xs mt-1">{t('messages.startConversation')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex-1 overflow-y-auto px-4 py-4 space-y-4',
        className
      )}
    >
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="h-px bg-border flex-1" />
            <span className="px-3 text-xs text-muted-foreground font-medium">
              {formatDateLabel(group.date, t('messages.today'), t('messages.yesterday'))}
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* Messages for this date */}
          <div className="space-y-2">
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}

/**
 * Format date for display
 */
function formatDateLabel(dateStr: string, todayLabel: string, yesterdayLabel: string): string {
  const [day, month, year] = dateStr.split('/')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if today
  if (date.toDateString() === today.toDateString()) {
    return todayLabel
  }

  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return yesterdayLabel
  }

  // Otherwise show full date
  return dateStr
}
