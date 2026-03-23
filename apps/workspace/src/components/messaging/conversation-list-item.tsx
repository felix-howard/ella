/**
 * Conversation List Item - Single conversation row in unified inbox
 * Shows client name, last message preview, time, and unread badge
 */

import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Phone, Globe, Bot } from 'lucide-react'
import { getInitials, formatRelativeTime, sanitizeText, getAvatarColor } from '../../lib/formatters'
import type { Conversation } from '../../lib/api-client'

export interface ConversationListItemProps {
  conversation: Conversation
  isActive?: boolean
}

// Channel icons
const CHANNEL_ICONS = {
  SMS: Phone,
  PORTAL: Globe,
  SYSTEM: Bot,
} as const

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isActive,
}: ConversationListItemProps) {
  const { t, i18n } = useTranslation()
  const { client, taxCase: _taxCase, lastMessage, unreadCount } = conversation
  const locale = i18n.language === 'vi' ? 'vi' : 'en'
  const hasUnread = unreadCount > 0

  const ChannelIcon = lastMessage ? CHANNEL_ICONS[lastMessage.channel] : null
  const avatarColor = getAvatarColor(client.name)

  // Truncate and sanitize last message
  const messagePreview = lastMessage
    ? sanitizeText(lastMessage.content).slice(0, 60) + (lastMessage.content.length > 60 ? '...' : '')
    : t('messages.noMessages')

  return (
    <Link
      to="/messages/$caseId"
      params={{ caseId: conversation.caseId }}
      className={cn(
        'flex items-start gap-3 px-3 py-3 mx-2 my-0.5 rounded-xl transition-all duration-200 cursor-pointer',
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
          {ChannelIcon && (
            <ChannelIcon className={cn(
              'w-3 h-3 flex-shrink-0',
              isActive ? 'text-foreground/70' : 'text-muted-foreground'
            )} />
          )}
          <p
            className={cn(
              'text-xs truncate',
              isActive
                ? 'text-foreground'
                : hasUnread
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            )}
          >
            {lastMessage?.direction === 'OUTBOUND' && (
              <span className={isActive ? 'text-foreground/70' : 'text-muted-foreground'}>{t('messages.you')} </span>
            )}
            {messagePreview}
          </p>
        </div>

      </div>
    </Link>
  )
})
