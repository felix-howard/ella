import type React from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ActivityTimelineItem } from '../../lib/api-client'
import { formatFullDateTime, formatRelativeTime, getAvatarColor, getInitials } from '../../lib/formatters'
import { getActivityIconConfig } from './activity-icons'

type ActivityRowProps = {
  item: ActivityTimelineItem
}

export function ActivityRow({ item }: ActivityRowProps) {
  const { t, i18n } = useTranslation()
  const { icon: Icon, className } = getActivityIconConfig(item.category)
  const actorName = item.actor.name ?? t(`activity.actor.${item.actor.type}`)
  const title = formatFullDateTime(item.createdAt)
  const content = (
    <div className="flex gap-3 py-3">
      <div className={cn('z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', className)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ActorAvatar item={item} fallbackName={actorName} />
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{actorName}</span>
          <span className="text-xs text-muted-foreground">{t(`activity.category.${item.category}`)}</span>
          {item.riskLevel !== 'LOW' && <RiskBadge riskLevel={item.riskLevel} />}
        </div>
        <p className="mt-1 break-words text-sm leading-5 text-foreground">{item.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.target.label && <span className="max-w-full truncate">{item.target.label}</span>}
          <time dateTime={item.createdAt} title={title}>
            {formatRelativeTime(item.createdAt, i18n.language)}
          </time>
        </div>
      </div>
    </div>
  )

  return <ActivityRowLink item={item}>{content}</ActivityRowLink>
}

function ActorAvatar({ item, fallbackName }: { item: ActivityTimelineItem; fallbackName: string }) {
  const avatarColor = getAvatarColor(fallbackName)

  if (item.actor.avatarUrl) {
    return (
      <img
        src={item.actor.avatarUrl}
        alt=""
        className="h-6 w-6 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <span
      className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', avatarColor.bg, avatarColor.text)}
      aria-hidden="true"
    >
      {getInitials(fallbackName)}
    </span>
  )
}

function RiskBadge({ riskLevel }: { riskLevel: ActivityTimelineItem['riskLevel'] }) {
  const { t } = useTranslation()
  const className = riskLevel === 'HIGH'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-700'

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', className)}>
      {t(`activity.risk.${riskLevel}`)}
    </span>
  )
}

function ActivityRowLink({ item, children }: { item: ActivityTimelineItem; children: React.ReactNode }) {
  const className = 'block rounded-lg px-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  if (item.category === 'MESSAGE' && item.caseId) {
    return <Link to="/messages/$caseId" params={{ caseId: item.caseId }} className={className}>{children}</Link>
  }
  if (item.clientId) {
    return <Link to="/clients/$clientId" params={{ clientId: item.clientId }} className={className}>{children}</Link>
  }
  if (item.caseId) {
    return <Link to="/cases/$caseId/entry" params={{ caseId: item.caseId }} className={className}>{children}</Link>
  }
  if (item.target.type === 'LEAD' && item.target.id) {
    return <Link to="/leads/$leadId" params={{ leadId: item.target.id }} className={className}>{children}</Link>
  }

  return <div className="rounded-lg px-2">{children}</div>
}
