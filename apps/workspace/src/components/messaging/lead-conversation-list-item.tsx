import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { getAvatarColor, getInitials, formatRelativeTime } from '../../lib/formatters'
import { getConversationMessagePreview, type PreviewTranslator } from './conversation-message-preview'
import type { LeadConversation } from '../../lib/api-client'

export interface LeadConversationListItemProps {
  conversation: LeadConversation
  isActive?: boolean
}

export const LeadConversationListItem = memo(function LeadConversationListItem({
  conversation,
  isActive,
}: LeadConversationListItemProps) {
  const { t, i18n } = useTranslation()
  const { lead, lastMessage, unreadCount } = conversation
  const locale = i18n.language === 'vi' ? 'vi' : 'en'
  const hasUnread = unreadCount > 0
  const displayName = lead.name || lead.phone || t('leadMessages.unknownLead')
  const avatarColor = getAvatarColor(displayName)
  const translatePreview: PreviewTranslator = (key, options) => {
    if (typeof options === 'string') return t(key, options)
    if (options) return t(key, options)
    return t(key)
  }
  const messagePreview = getConversationMessagePreview(lastMessage, translatePreview)

  return (
    <Link
      to="/lead-messages/$leadId"
      params={{ leadId: conversation.leadId }}
      className={cn(
        'flex items-start gap-3 px-3 py-3 mx-2 my-0.5 rounded-xl transition-all duration-200 cursor-pointer',
        isActive && 'bg-primary/10 shadow-sm ring-1 ring-primary/20',
        hasUnread && !isActive && 'bg-success/5 hover:bg-success/10',
        !isActive && !hasUnread && 'hover:bg-muted/50'
      )}
    >
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center shadow-sm',
            avatarColor.bg,
            avatarColor.text
          )}
        >
          <span className="text-sm font-medium">{getInitials(displayName)}</span>
        </div>
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-success rounded-full flex items-center justify-center ring-2 ring-card shadow-sm">
            <span className="text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h3
            className={cn(
              'min-w-0 truncate text-sm',
              isActive
                ? 'font-semibold text-primary'
                : hasUnread
                  ? 'font-semibold text-foreground'
                  : 'font-medium text-foreground'
            )}
          >
            {displayName}
          </h3>
          {lastMessage && (
            <span className={cn(
              'text-xs flex-shrink-0',
              isActive ? 'text-primary/70' : 'text-muted-foreground'
            )}>
              {formatRelativeTime(lastMessage.createdAt, locale)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
            {t('leadMessages.leadBadge')}
          </span>
          <p
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              isActive || hasUnread ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {lastMessage?.direction === 'OUTBOUND' && !lastMessage.sentBy && (
              <span className={isActive ? 'text-foreground/70' : 'text-muted-foreground'}>
                {t('messages.you')}{' '}
              </span>
            )}
            {messagePreview}
          </p>
        </div>

        {lead.campaignTag && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
            {lead.campaignTag}
          </p>
        )}
      </div>
    </Link>
  )
})
