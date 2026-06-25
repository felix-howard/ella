import { cn } from '@ella/ui'
import type { StaffManagerSummary } from '../../../lib/api-client'
import { getAvatarColor, getInitials } from '../../../lib/formatters'

export function ManagerSummary({
  managers,
  archivedLabel,
}: {
  managers: StaffManagerSummary[]
  archivedLabel: string
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {managers.map((manager) => (
        <span
          key={manager.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/70 px-2 py-1 text-sm font-medium text-foreground"
        >
          <StaffAvatar name={manager.name} avatarUrl={manager.avatarUrl ?? null} size="sm" />
          <span className="min-w-0 whitespace-normal break-words leading-snug">{manager.name}</span>
          {manager.isActive === false && <ArchivedBadge label={archivedLabel} />}
        </span>
      ))}
    </span>
  )
}

export function ManagerList({
  managers,
  archivedLabel,
}: {
  managers: StaffManagerSummary[]
  archivedLabel: string
}) {
  return (
    <div className="space-y-2">
      {managers.map((manager) => (
        <div key={manager.id} className="flex items-center gap-2">
          <StaffAvatar name={manager.name} avatarUrl={manager.avatarUrl ?? null} size="sm" />
          <span className="min-w-0 truncate text-sm text-foreground">{manager.name}</span>
          {manager.isActive === false && <ArchivedBadge label={archivedLabel} />}
        </div>
      ))}
    </div>
  )
}

export function StaffAvatar({
  name,
  avatarUrl,
  size = 'sm',
}: {
  name: string
  avatarUrl: string | null
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  const avatarColor = getAvatarColor(name)

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={cn(sizeClass, 'rounded-full object-cover')} />
  }

  return (
    <span
      className={cn(
        sizeClass,
        'rounded-full flex items-center justify-center font-medium',
        avatarColor.bg,
        avatarColor.text
      )}
    >
      {getInitials(name)}
    </span>
  )
}

function ArchivedBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
      {label}
    </span>
  )
}
