/**
 * Lead Activity Timeline — vertical dot timeline of non-message events
 * (created, NDA lifecycle, converted, status). Derived from existing
 * timestamps; no AuditLog in v1 so status history is not preserved.
 */
import { useTranslation } from 'react-i18next'
import { UserPlus, FileText, Eye, CheckCircle2, Award, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAgreementsList } from '../../agreements/use-agreement-mutations'
import { CardSection } from '../../shared/card-section'
import type { Lead } from '../../../lib/api-client'
import {
  deriveLeadActivityEvents,
  type TimelineEventType,
} from '../../../lib/derive-lead-activity-events'
import { TimelineRow } from './timeline-row'

const ICON_BY_TYPE: Record<TimelineEventType, LucideIcon> = {
  created: UserPlus,
  'nda-sent': FileText,
  'nda-viewed': Eye,
  'nda-signed': CheckCircle2,
  converted: Award,
  status: RefreshCw,
}

interface Props {
  lead: Lead
}

export function LeadActivityTimeline({ lead }: Props) {
  const { t } = useTranslation()

  const { data } = useAgreementsList({ type: 'lead', id: lead.id })

  const events = deriveLeadActivityEvents(lead, data?.data ?? [])

  return (
    <CardSection title={t('leads.activity.title')}>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('leads.activity.empty')}</p>
      ) : (
        <ol className="relative">
          {events.map((e, idx) => {
            const values = e.titleValues
              ? Object.fromEntries(
                  Object.entries(e.titleValues).map(([k, v]) =>
                    k === 'status' ? [k, t(`leads.status.${v}`, v)] : [k, v]
                  )
                )
              : undefined
            const title = values ? t(e.titleKey, values) : t(e.titleKey)
            return (
              <TimelineRow
                key={e.id}
                icon={ICON_BY_TYPE[e.type]}
                color={e.color}
                title={title}
                subtitle={e.subtitle}
                timestamp={e.timestamp}
                showConnector={idx < events.length - 1}
              />
            )
          })}
        </ol>
      )}
    </CardSection>
  )
}
