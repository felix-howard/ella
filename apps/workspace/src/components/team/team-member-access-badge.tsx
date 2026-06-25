import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, cn } from '@ella/ui'
import type { TeamMembershipStatus } from '../../lib/api-client'

interface TeamMemberAccessBadgeProps {
  status?: TeamMembershipStatus
  isActive?: boolean
}

export function TeamMemberAccessBadge({ status, isActive }: TeamMemberAccessBadgeProps) {
  const { t } = useTranslation()
  const displayStatus = status ?? (isActive === false ? 'ARCHIVED_MATCH' : 'ACTIVE_MATCH')

  if (displayStatus === 'ARCHIVED_STILL_IN_CLERK') {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {t('team.seatStillOccupied', 'Seat still occupied')}
      </Badge>
    )
  }

  if (displayStatus === 'ACTIVE_MISSING_CLERK') {
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        <XCircle className="mr-1 h-3 w-3" />
        {t('team.missingFromClerk', 'Missing from Clerk')}
      </Badge>
    )
  }

  if (displayStatus === 'PENDING_INVITATION') {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">
        <Clock className="mr-1 h-3 w-3" />
        {t('team.pendingInviteAccess', 'Pending invite')}
      </Badge>
    )
  }

  const isArchived = displayStatus === 'ARCHIVED_MATCH'

  return (
    <Badge
      variant="outline"
      className={cn(
        isArchived
          ? 'border-muted-foreground/30 text-muted-foreground'
          : 'border-primary/30 bg-primary/10 text-primary'
      )}
    >
      {!isArchived && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {isArchived ? t('team.archived', 'Archived') : t('team.active', 'Active')}
    </Badge>
  )
}
