/**
 * Derive chronological activity events for a Lead from existing timestamps.
 * v1 is derive-only: no AuditLog table. Historic status changes are lost —
 * only the current status (via updatedAt) is surfaced.
 */
import type { Agreement, Lead } from './api-client'

export type TimelineEventType =
  | 'created'
  | 'nda-sent'
  | 'nda-viewed'
  | 'nda-signed'
  | 'converted'
  | 'status'
  | 'sms'

export type TimelineEventColor = 'mint' | 'coral' | 'blue' | 'gray'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  titleKey: string
  titleValues?: Record<string, string>
  subtitle?: string
  timestamp: string
  color: TimelineEventColor
}

export function deriveLeadActivityEvents(
  lead: Lead,
  agreements: Agreement[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({
    id: `created-${lead.id}`,
    type: 'created',
    titleKey: 'leads.activity.created',
    timestamp: lead.createdAt,
    color: 'blue',
  })

  for (const nda of agreements) {
    if (nda.status === 'SENT' || nda.status === 'SIGNED' || nda.status === 'EXPIRED' || nda.status === 'VOIDED') {
      events.push({
        id: `nda-sent-${nda.id}`,
        type: 'nda-sent',
        titleKey: 'leads.activity.ndaSent',
        subtitle: `v${nda.templateVersion}`,
        timestamp: nda.createdAt,
        color: 'mint',
      })
    }
    if (nda.lastUsedAt && nda.usageCount > 0 && nda.status !== 'DRAFT') {
      events.push({
        id: `nda-viewed-${nda.id}`,
        type: 'nda-viewed',
        titleKey: 'leads.activity.ndaViewed',
        timestamp: nda.lastUsedAt,
        color: 'mint',
      })
    }
    if (nda.signedAt) {
      events.push({
        id: `nda-signed-${nda.id}`,
        type: 'nda-signed',
        titleKey: 'leads.activity.ndaSigned',
        subtitle: nda.signerName ?? undefined,
        timestamp: nda.signedAt,
        color: 'mint',
      })
    }
  }

  if (lead.convertedAt) {
    events.push({
      id: `converted-${lead.id}`,
      type: 'converted',
      titleKey: 'leads.activity.converted',
      timestamp: lead.convertedAt,
      color: 'coral',
    })
  }

  const latestSms = lead.latestSms ?? (
    lead.smsSendLogs?.[0] && isLeadSmsStatus(lead.smsSendLogs[0].status)
      ? {
          status: lead.smsSendLogs[0].status,
          error: lead.smsSendLogs[0].error ?? null,
          sentAt: lead.smsSendLogs[0].sentAt,
        }
      : null
  )

  if (latestSms) {
    const isFailure = latestSms.status === 'FAILED' || latestSms.status === 'UNDELIVERED'
    events.push({
      id: `sms-${lead.id}-${latestSms.sentAt}`,
      type: 'sms',
      titleKey: `leads.activity.sms.${latestSms.status}`,
      subtitle: isFailure ? latestSms.error ?? undefined : undefined,
      timestamp: latestSms.sentAt,
      color: isFailure ? 'coral' : latestSms.status === 'DELIVERED' ? 'mint' : 'gray',
    })
  }

  // Current status (no history) — surface only if meaningful and different from NEW
  if (lead.status !== 'NEW' && lead.status !== 'CONVERTED' && lead.updatedAt !== lead.createdAt) {
    events.push({
      id: `status-${lead.id}`,
      type: 'status',
      titleKey: 'leads.activity.statusChanged',
      titleValues: { status: lead.status },
      timestamp: lead.updatedAt,
      color: 'gray',
    })
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return events
}

function isLeadSmsStatus(status: string): status is NonNullable<Lead['latestSms']>['status'] {
  return status === 'SENT' || status === 'DELIVERED' || status === 'UNDELIVERED' || status === 'FAILED'
}
