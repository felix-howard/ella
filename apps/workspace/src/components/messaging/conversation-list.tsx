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
          <div key={i} className="flex items-start gap-3 px-3 py-3 mx-2 my-0.5 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-muted/60" />
            <div className="flex-1 space-y-2.5 pt-0.5">
              <div className="h-3.5 w-28 bg-muted/60 rounded-md" />
              <div className="h-3 w-44 bg-muted/40 rounded-md" />
              <div className="h-2.5 w-14 bg-muted/30 rounded-md" />
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
          <div className="w-14 h-14 rounded-2xl bg-muted/50 mx-auto mb-4 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            Chưa có cuộc hội thoại
          </h3>
          <p className="text-xs text-muted-foreground">
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
