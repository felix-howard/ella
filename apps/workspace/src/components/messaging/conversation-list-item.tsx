/**
 * Conversation List Item - Single conversation row in unified inbox
 * Shows client name, last message preview, time, and unread badge
 */

import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Building2 } from 'lucide-react'
import { getInitials, formatRelativeTime, getAvatarColor } from '../../lib/formatters'
import { getConversationMessagePreview, type PreviewTranslator } from './conversation-message-preview'
import type { Conversation } from '../../lib/api-client'

export interface ConversationListItemProps {
  conversation: Conversation
  isActive?: boolean
  /** When true, item is rendered inside a group container — adjusts margins */
  isGrouped?: boolean
}

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isActive,
  isGrouped,
}: ConversationListItemProps) {
  const { t, i18n } = useTranslation()
  const { client, taxCase: _taxCase, lastMessage, unreadCount } = conversation
  const locale = i18n.language === 'vi' ? 'vi' : 'en'
  const hasUnread = unreadCount > 0

  const avatarColor = getAvatarColor(client.name)
  const translatePreview: PreviewTranslator = (key, options) => {
    if (typeof options === 'string') return t(key, options)
    if (options) return t(key, options)
    return t(key)
  }
  const messagePreview = getConversationMessagePreview(lastMessage, translatePreview)

  return (
    <Link
      to="/messages/$caseId"
      params={{ caseId: conversation.caseId }}
      className={cn(
        'flex items-start gap-3 px-3 py-3 transition-all duration-200 cursor-pointer',
        // When grouped, no outer margins or rounded corners (container handles it)
        isGrouped ? 'mx-0 my-0 rounded-lg' : 'mx-2 my-0.5 rounded-xl',
        // Active state: primary tint with left accent
        isActive && 'bg-primary/10 shadow-sm ring-1 ring-primary/20',
        // Unread state: subtle highlight
        hasUnread && !isActive && 'bg-primary/5 hover:bg-primary/10',
        // Default state: clean hover
        !isActive && !hasUnread && 'hover:bg-muted/50'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center shadow-sm',
            avatarColor.bg,
            avatarColor.text
          )}
        >
          <span className="text-sm font-medium">{getInitials(client.name)}</span>
        </div>
        {/* Business indicator */}
        {client.clientType === 'BUSINESS' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-card">
            <Building2 className="w-2.5 h-2.5 text-white" />
          </span>
        )}
        {/* Unread indicator dot */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-error rounded-full flex items-center justify-center ring-2 ring-card shadow-sm">
            <span className="text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between mb-0.5">
          <h3
            className={cn(
              'text-sm truncate',
              isActive
                ? 'font-semibold text-primary'
                : hasUnread
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-foreground'
            )}
          >
            {client.name}
          </h3>
          {lastMessage && (
            <span className={cn(
              'text-xs flex-shrink-0 ml-2',
              isActive ? 'text-primary/70' : 'text-muted-foreground'
            )}>
              {formatRelativeTime(lastMessage.createdAt, locale)}
            </span>
          )}
        </div>

        {/* Message preview */}
        <div className="flex items-center gap-1.5">
          {lastMessage?.direction === 'OUTBOUND' && lastMessage.sentBy && (
            <SenderAvatar sentBy={lastMessage.sentBy} />
          )}
          <p
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              isActive
                ? 'text-foreground'
                : hasUnread
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            )}
          >
            {lastMessage?.direction === 'OUTBOUND' && !lastMessage.sentBy && (
              <span className={isActive ? 'text-foreground/70' : 'text-muted-foreground'}>{t('messages.you')} </span>
            )}
            {messagePreview}
          </p>
        </div>

      </div>
    </Link>
  )
})

function SenderAvatar({ sentBy }: { sentBy: NonNullable<NonNullable<Conversation['lastMessage']>['sentBy']> }) {
  if (sentBy.avatarUrl) {
    return (
      <img
        src={sentBy.avatarUrl}
        alt={sentBy.name}
        title={sentBy.name}
        className="h-4 w-4 flex-shrink-0 rounded-full object-cover"
      />
    )
  }

  const colors = getAvatarColor(sentBy.name)

  return (
    <span
      title={sentBy.name}
      className={cn(
        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[8px] font-semibold leading-none',
        colors.bg,
        colors.text
      )}
    >
      {getInitials(sentBy.name)}
    </span>
  )
}
