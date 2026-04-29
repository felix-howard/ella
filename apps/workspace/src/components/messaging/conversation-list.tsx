/**
 * Conversation List - List of all conversations for unified inbox
 * Displays sorted list with empty and loading states
 * Groups linked conversations (same clientGroup) together
 */

import { useMemo } from 'react'
import { cn } from '@ella/ui'
import { Inbox, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConversationListItem } from './conversation-list-item'
import type { Conversation } from '../../lib/api-client'

export interface ConversationListProps {
  conversations: Conversation[]
  activeCaseId?: string
  isLoading?: boolean
  className?: string
}

type ListEntry =
  | { type: 'single'; conversation: Conversation }
  | { type: 'group'; groupName: string; conversations: Conversation[] }

export function ConversationList({
  conversations,
  activeCaseId,
  isLoading,
  className,
}: ConversationListProps) {
  const { t } = useTranslation()

  // Group conversations by clientGroupId while preserving sort order
  const entries = useMemo<ListEntry[]>(() => {
    // Build a map of groupId -> conversations
    const groupMap = new Map<string, Conversation[]>()
    const seenGroups = new Set<string>()
    const result: ListEntry[] = []

    // First pass: collect groups
    for (const conv of conversations) {
      const gid = conv.client.clientGroupId
      if (gid) {
        if (!groupMap.has(gid)) groupMap.set(gid, [])
        groupMap.get(gid)!.push(conv)
      }
    }

    // Second pass: build entries in original order, emitting group on first encounter
    for (const conv of conversations) {
      const gid = conv.client.clientGroupId
      if (gid && groupMap.get(gid)!.length > 1) {
        // Part of a multi-member group
        if (!seenGroups.has(gid)) {
          seenGroups.add(gid)
          result.push({
            type: 'group',
            groupName: conv.client.clientGroupName || t('messages.linkedGroup', 'Linked'),
            conversations: groupMap.get(gid)!,
          })
        }
        // Skip individual rendering — handled by group entry
      } else {
        result.push({ type: 'single', conversation: conv })
      }
    }

    return result
  }, [conversations, t])

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
            {t('messages.noConversations')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('messages.noConversationsHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      {entries.map((entry) => {
        if (entry.type === 'single') {
          return (
            <ConversationListItem
              key={entry.conversation.id}
              conversation={entry.conversation}
              isActive={entry.conversation.caseId === activeCaseId}
            />
          )
        }

        // Grouped conversations — render inside a visual container
        const groupId = entry.conversations[0].client.clientGroupId!
        return (
          <div
            key={`group-${groupId}`}
            className="mx-2 my-1 rounded-xl border border-border/60 bg-muted/20 overflow-hidden"
          >
            {/* Group header */}
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Link2 className="w-3 h-3 text-muted-foreground/70" />
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {entry.groupName}
              </span>
            </div>
            {/* Group members */}
            {entry.conversations.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                isActive={conv.caseId === activeCaseId}
                isGrouped
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
