/**
 * Conversation List - List of all conversations for unified inbox
 * Displays sorted list with empty and loading states
 */

import { cn } from '@ella/ui'
import { Inbox } from 'lucide-react'
import { ConversationListItem } from './conversation-list-item'
import type { Conversation } from '../../lib/api-client'

export interface ConversationListProps {
  conversations: Conversation[]
  activeCaseId?: string
  isLoading?: boolean
  className?: string
}

export function ConversationList({
  conversations,
  activeCaseId,
  isLoading,
  className,
}: ConversationListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex-1 overflow-y-auto', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground mb-1">
            Chưa có cuộc hội thoại
          </h3>
          <p className="text-sm text-muted-foreground">
            Tin nhắn với khách hàng sẽ xuất hiện ở đây
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.caseId === activeCaseId}
        />
      ))}
    </div>
  )
}
