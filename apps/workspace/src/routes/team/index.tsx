/**
 * Team page - admins manage org members; non-admin staff see their own profile row.
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { UserPlus, Mail, Loader2 } from 'lucide-react'
import { Switch } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { PendingInvitationRow } from '../../components/team/pending-invitation-row'
import { TeamMemberTable } from '../../components/team/team-member-table'
import { TeamSeatSummary } from '../../components/team/team-seat-summary'
import { InviteMemberDialog } from '../../components/team/invite-member-dialog'
import { useOrgRole } from '../../hooks/use-org-role'
import { api } from '../../lib/api-client'
import { buildReconciliationByStaffId } from '../../lib/team-reconciliation'

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

  const {
    data: reconciliationData,
    isLoading: isReconciliationLoading,
    isError: isReconciliationError,
  } = useQuery({
    queryKey: ['team-reconciliation'],
    queryFn: () => api.team.getReconciliation(),
    enabled: canManageTeam,
  })

  const members = membersData?.data ?? []
  const invitations = invitationsData?.data ?? []
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')
  const reconciliationByStaffId = useMemo(
    () => buildReconciliationByStaffId(reconciliationData?.members),
    [reconciliationData?.members]
  )

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
              {t('team.members')}
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

      {canManageTeam && (
        <TeamSeatSummary
          reconciliation={reconciliationData}
          isLoading={isReconciliationLoading}
          isError={isReconciliationError}
          fallbackActiveCount={members.length}
        />
      )}

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
        reconciliationByStaffId={reconciliationByStaffId}
      />

      {/* Invite Dialog */}
      {canManageTeam && isInviteOpen && (
        <InviteMemberDialog
          isOpen
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </PageContainer>
  )
}
