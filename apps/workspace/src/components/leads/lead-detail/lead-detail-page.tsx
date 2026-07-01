/**
 * Lead detail top-level layout — unified header (matches client detail)
 * with a 2-column content grid: main (activity, agreements, notes) +
 * sidebar (status, tags, danger zone). Includes floating chatbox for SMS.
 */
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LeadDetailHeader } from './lead-detail-header'
import { LeadInfoGrid } from './lead-info-grid'
import { LeadActivityTimeline } from './lead-activity-timeline'
import { LeadNotesSection } from './lead-notes-section'
import { LeadDangerZone } from './lead-danger-zone'
import { AgreementsTab } from '../../agreements/agreements-tab'
import { FloatingChatbox } from '../../chatbox'
import { ErrorBoundary } from '../../error-boundary'
import { useChatUnread } from '../../../hooks/use-chat-unread'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadDetailPage({ lead }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    unreadCount,
    isLoading: isUnreadLoading,
    refetch: refetchUnread,
  } = useChatUnread({ type: 'lead', leadId: lead.id })

  // Debounce refetch so the server has time to commit before we poll.
  const handleUnreadChange = useCallback(() => {
    setTimeout(() => {
      refetchUnread()
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-unread-summary'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    }, 500)
  }, [lead.id, queryClient, refetchUnread])

  const fullName = `${lead.firstName} ${lead.lastName}`.trim()

  return (
    <div className="w-full">
      <LeadDetailHeader lead={lead} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <LeadActivityTimeline lead={lead} />
          <AgreementsTab
            entity={{ type: 'lead', id: lead.id }}
            recipient={{
              id: lead.id,
              firstName: lead.firstName,
              lastName: lead.lastName,
              phone: lead.phone,
            }}
            enabled={true}
          />
          <LeadNotesSection lead={lead} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-0">
          <LeadInfoGrid lead={lead} />
          <LeadDangerZone lead={lead} />
        </div>
      </div>

      <ErrorBoundary
        fallback={
          <div className="fixed bottom-6 right-6 z-50 text-xs text-muted-foreground">
            {t('clientDetail.chatboxUnavailable')}
          </div>
        }
      >
        <FloatingChatbox
          context={{ type: 'lead', leadId: lead.id }}
          headerProps={{ title: fullName, phone: lead.phone }}
          unreadCount={isUnreadLoading ? 0 : unreadCount}
          onUnreadChange={handleUnreadChange}
        />
      </ErrorBoundary>
    </div>
  )
}
