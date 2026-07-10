import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { useIsMobile } from '../../hooks/use-mobile-breakpoint'
import { api } from '../../lib/api-client'

export const Route = createFileRoute('/lead-messages/')({
  component: LeadMessagesIndex,
})

function LeadMessagesIndex() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const { data } = useSuspenseQuery({
    queryKey: ['lead-conversations', { limit: 1 }],
    queryFn: () => api.leads.messages.listConversations({ limit: 1 }),
  })

  useEffect(() => {
    if (!isMobile && data?.conversations?.length > 0) {
      navigate({
        to: '/lead-messages/$leadId',
        params: { leadId: data.conversations[0].leadId },
        replace: true,
      })
    }
  }, [data, navigate, isMobile])

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/40 mx-auto mb-5 flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h2 className="text-base font-medium text-foreground/80 mb-1.5">
          {t('leadMessages.selectConversation')}
        </h2>
        <p className="text-sm text-muted-foreground/60 max-w-xs">
          {t('leadMessages.selectConversationDesc')}
        </p>
      </div>
    </div>
  )
}
