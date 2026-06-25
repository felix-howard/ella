import { AlertTriangle, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import type { TeamMembershipStatus } from '../../lib/api-client'
import { hasClerkSeat } from '../../lib/team-reconciliation'

interface StaffAccessStatusBannerProps {
  membershipStatus?: TeamMembershipStatus
  canInviteAgain: boolean
  onInviteAgain: () => void
}

export function StaffAccessStatusBanner({
  membershipStatus,
  canInviteAgain,
  onInviteAgain,
}: StaffAccessStatusBannerProps) {
  const { t } = useTranslation()
  const stillHasClerkSeat = hasClerkSeat(membershipStatus)

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-6 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {stillHasClerkSeat
            ? t('team.archivedMemberSeatBanner')
            : t('team.archivedMemberBanner')}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          {stillHasClerkSeat
            ? t('team.archivedMemberSeatBannerDesc')
            : t('team.archivedMemberBannerDesc')}
        </p>
      </div>
      {canInviteAgain && (
        <Button
          variant="outline"
          size="sm"
          onClick={onInviteAgain}
          className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          {t('team.inviteAgain')}
        </Button>
      )}
    </div>
  )
}
