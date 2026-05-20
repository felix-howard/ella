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
  const actorName = item.actor.name
    ?? (item.actor.type === 'CLIENT_PORTAL' && item.clientId ? item.target.label : null)
    ?? t(`activity.actor.${item.actor.type}`)
  const title = formatFullDateTime(item.createdAt)
  const content = (
    <div className="flex gap-2 py-2">
      <div className={cn('z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', className)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-5">
          <ActorAvatar item={item} fallbackName={actorName} />
          <span className="font-semibold text-foreground">{actorName}</span>
          <span className="break-words text-foreground">{item.summary}</span>
          <span className="text-xs text-muted-foreground">{t(`activity.category.${item.category}`)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-4 text-muted-foreground">
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
        className="h-5 w-5 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <span
      className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold', avatarColor.bg, avatarColor.text)}
      aria-hidden="true"
    >
      {getInitials(fallbackName)}
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
