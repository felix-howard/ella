/**
 * Messages Index - Empty state when no conversation is selected
 * Auto-redirects to first conversation if available
 */

import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'
import { useIsMobile } from '../../hooks/use-mobile-breakpoint'
import { api } from '../../lib/api-client'

export const Route = createFileRoute('/messages/')({
  component: MessagesIndex,
})

function MessagesIndex() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Fetch conversations to auto-redirect to first one (desktop only)
  const { data } = useSuspenseQuery({
    queryKey: ['conversations', { limit: 1 }],
    queryFn: () => api.messages.listConversations({ limit: 1 }),
  })

  // Auto-redirect to first conversation on desktop only
  // On mobile, user sees the conversation list and picks manually
  useEffect(() => {
    if (!isMobile && data?.conversations?.length > 0) {
      navigate({
        to: '/messages/$caseId',
        params: { caseId: data.conversations[0].caseId },
        replace: true,
      })
    }
  }, [data, navigate, isMobile])

  // Show empty state while redirecting or if no conversations
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          {t('messages.selectConversation')}
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {t('messages.selectConversationDesc')}
        </p>
      </div>
    </div>
  )
}
