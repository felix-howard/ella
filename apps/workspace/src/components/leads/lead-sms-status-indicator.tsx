/**
 * Compact latest SMS delivery signal for lead list/detail surfaces.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock3, MessageCircle, TriangleAlert, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@ella/ui'
import { formatShortRelativeTime } from '../../lib/formatters'
import type { LatestLeadSms } from '../../lib/api-client'

type IndicatorTone = 'neutral' | 'pending' | 'success' | 'danger'

const STATUS_CONFIG: Record<LatestLeadSms['status'], { icon: LucideIcon; tone: IndicatorTone; labelKey: string }> = {
  SENT: { icon: Clock3, tone: 'pending', labelKey: 'leads.smsStatus.SENT' },
  DELIVERED: { icon: CheckCircle2, tone: 'success', labelKey: 'leads.smsStatus.DELIVERED' },
  UNDELIVERED: { icon: TriangleAlert, tone: 'danger', labelKey: 'leads.smsStatus.UNDELIVERED' },
  FAILED: { icon: XCircle, tone: 'danger', labelKey: 'leads.smsStatus.FAILED' },
}

const TONE_CLASSES: Record<IndicatorTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-700',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-50/70 text-red-600 ring-1 ring-red-100',
}

interface LeadSmsStatusIndicatorProps {
  sms?: LatestLeadSms | null
  compact?: boolean
}

export function LeadSmsStatusIndicator({ sms, compact = false }: LeadSmsStatusIndicatorProps) {
  const { t, i18n } = useTranslation()

  if (!sms) {
    if (compact) return null

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full text-xs font-medium',
          compact ? 'px-2 py-0.5' : 'px-2.5 py-1',
          TONE_CLASSES.neutral,
        )}
        title={t('leads.smsStatus.noneHelp')}
      >
        <MessageCircle className="h-3 w-3" aria-hidden="true" />
        {t('leads.smsStatus.none')}
      </span>
    )
  }

  const config = STATUS_CONFIG[sms.status]
  const Icon = config.icon
  const label = t(config.labelKey)
  const time = formatShortRelativeTime(sms.sentAt, i18n.language)
  const help = sms.error
    ? t('leads.smsStatus.helpWithError', { status: label, time, error: sms.error })
    : t('leads.smsStatus.help', { status: label, time })

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 self-start rounded-full text-xs font-medium',
        compact ? 'px-2 py-0.5' : 'px-2.5 py-1',
        TONE_CLASSES[config.tone],
      )}
      title={help}
      aria-label={help}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{compact ? label : t('leads.smsStatus.withTime', { status: label, time })}</span>
    </span>
  )
}
