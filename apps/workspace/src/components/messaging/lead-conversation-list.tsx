import { cn } from '@ella/ui'
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LeadConversationListItem } from './lead-conversation-list-item'
import type { LeadConversation } from '../../lib/api-client'

export interface LeadConversationListProps {
  conversations: LeadConversation[]
  activeLeadId?: string
  isLoading?: boolean
  className?: string
}

export function LeadConversationList({
  conversations,
  activeLeadId,
  isLoading,
  className,
}: LeadConversationListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className={cn('flex-1 overflow-y-auto', className)}>
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex items-start gap-3 px-3 py-3 mx-2 my-0.5 animate-pulse">
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

  if (conversations.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 mx-auto mb-4 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            {t('leadMessages.noConversations')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('leadMessages.noConversationsHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      {conversations.map((conversation) => (
        <LeadConversationListItem
          key={conversation.leadId}
          conversation={conversation}
          isActive={conversation.leadId === activeLeadId}
        />
      ))}
    </div>
  )
}
