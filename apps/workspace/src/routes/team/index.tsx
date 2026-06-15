/**
 * Team page - admins manage org members; non-admin staff see their own profile row.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { UserPlus, Mail, Loader2 } from 'lucide-react'
import { Badge, Switch } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { TeamMemberTable } from '../../components/team/team-member-table'
import { InviteMemberDialog } from '../../components/team/invite-member-dialog'
import { useOrgRole } from '../../hooks/use-org-role'
import { api, type TeamInvitation } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export const Route = createFileRoute('/team/')({
  component: TeamPage,
})

function TeamPage() {
  const { t } = useTranslation()
  const { canManageTeam, canViewTeam, isLoading: isRoleLoading } = useOrgRole()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Fetch team members
  const {
    data: membersData,
    isLoading: isMembersLoading,
    isError,
  } = useQuery({
    queryKey: ['team-members', { includeArchived: canManageTeam && showArchived }],
    queryFn: () => api.team.listMembers({ includeArchived: canManageTeam && showArchived }),
    enabled: canViewTeam,
  })

  // Fetch pending invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: () => api.team.listInvitations(),
    enabled: canManageTeam,
  })

  const members = membersData?.data ?? []
  const invitations = invitationsData?.data ?? []
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

  // Loading state
  if (isRoleLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </PageContainer>
    )
  }

  if (!canViewTeam) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16 text-center">
          <h3 className="text-lg font-medium text-foreground">{t('team.noAccess')}</h3>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('team.title')}</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-muted-foreground">
              {t('team.members')} ({members.length})
            </p>
            {canManageTeam && (
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  className="scale-75"
                />
                <span className="text-muted-foreground">{t('team.showArchived')}</span>
              </label>
            )}
          </div>
        </div>
        {canManageTeam && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            {t('team.inviteMember')}
          </button>
        )}
      </div>

      {/* Pending Invitations */}
      {canManageTeam && pendingInvitations.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            {t('team.invitations')} ({pendingInvitations.length})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <PendingInvitationRow key={inv.id} invitation={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Members Table */}
      <TeamMemberTable
        members={members}
        isLoading={isMembersLoading}
        isError={isError}
        showArchived={showArchived}
      />

      {/* Invite Dialog */}
      {canManageTeam && (
        <InviteMemberDialog
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </PageContainer>
  )
}

/** Single pending invitation row with revoke action */
function PendingInvitationRow({ invitation }: { invitation: TeamInvitation }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Intended Staff.role from invitation metadata distinguishes Manager invites
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
