/**
 * Lead detail top-level layout — composes header, info grid, activity timeline,
 * notes, agreements, danger zone, and floating chatbox for two-way SMS.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LeadDetailHeader } from './lead-detail-header'
import { LeadInfoGrid } from './lead-info-grid'
import { LeadActivityTimeline } from './lead-activity-timeline'
import { LeadNotesSection } from './lead-notes-section'
import { LeadDangerZone } from './lead-danger-zone'
import { AgreementsTab } from '../nda/agreements-tab'
import { FloatingChatbox } from '../../chatbox'
import { ErrorBoundary } from '../../error-boundary'
import { useChatUnread } from '../../../hooks/use-chat-unread'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadDetailPage({ lead }: Props) {
  const { t } = useTranslation()
  const {
    unreadCount,
    isLoading: isUnreadLoading,
    refetch: refetchUnread,
  } = useChatUnread({ type: 'lead', leadId: lead.id })

  // Debounce refetch so the server has time to commit before we poll.
  const handleUnreadChange = useCallback(() => {
    setTimeout(() => refetchUnread(), 500)
  }, [refetchUnread])

  const fullName = `${lead.firstName} ${lead.lastName}`.trim()

  return (
    <div className="max-w-5xl mx-auto w-full">
      <LeadDetailHeader lead={lead} />
      <div className="space-y-6">
        <LeadInfoGrid lead={lead} />
        <LeadActivityTimeline lead={lead} />
        <LeadNotesSection lead={lead} />
        <section className="rounded-xl border border-border/60 bg-card shadow-sm p-4">
          <AgreementsTab lead={lead} enabled={true} />
        </section>
        <LeadDangerZone lead={lead} />
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
