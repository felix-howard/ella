import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@ella/ui'
import { api, type TeamInvitation } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface PendingInvitationRowProps {
  invitation: TeamInvitation
}

/** Single pending invitation row with revoke action. */
export function PendingInvitationRow({ invitation }: PendingInvitationRowProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const inviteRoleLabel =
    invitation.staffRole === 'ADMIN' || invitation.role === 'org:admin'
      ? t('team.admin')
      : invitation.staffRole === 'MANAGER'
        ? t('team.manager')
        : t('team.member')

  const revokeMutation = useMutation({
    mutationFn: () => api.team.revokeInvitation(invitation.id),
    onSuccess: () => {
      toast.success(t('team.revokeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['team-reconciliation'] })
    },
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{invitation.emailAddress}</p>
          <p className="text-xs text-muted-foreground">
            {inviteRoleLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-11 sm:ml-0">
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {t('team.pendingInvite')}
        </Badge>
        <button
          onClick={() => revokeMutation.mutate()}
          disabled={revokeMutation.isPending}
          className="text-xs text-destructive hover:underline disabled:opacity-50 px-2 py-1 -my-1 rounded"
        >
          {t('team.revokeInvite')}
        </button>
      </div>
    </div>
  )
}
