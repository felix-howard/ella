/**
 * Team Management Page - Admin-only page for managing org members and assignments
 * Route: /team (guarded by org:admin role check)
 */
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, UserPlus, Mail, Loader2, ShieldAlert } from 'lucide-react'
import { cn, Button, Badge } from '@ella/ui'
import { PageContainer } from '../components/layout'
import { TeamMemberTable } from '../components/team/team-member-table'
import { InviteMemberDialog } from '../components/team/invite-member-dialog'
import { useOrgRole } from '../hooks/use-org-role'
import { api } from '../lib/api-client'
import { toast } from '../stores/toast-store'

export const Route = createFileRoute('/team')({
  component: TeamPage,
})

function TeamPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin, isLoading: isRoleLoading } = useOrgRole()
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  // Fetch team members
  const {
    data: membersData,
    isLoading: isMembersLoading,
    isError,
  } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isAdmin,
  })

  // Fetch pending invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: () => api.team.listInvitations(),
    enabled: isAdmin,
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

  // Not admin - redirect or show message
  if (!isAdmin) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('team.noAccess')}</h3>
          <Button variant="outline" onClick={() => navigate({ to: '/' })} className="mt-4">
            {t('nav.dashboard')}
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('team.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('team.members')} ({members.length})
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          {t('team.inviteMember')}
        </Button>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
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
      />

      {/* Invite Dialog */}
      <InviteMemberDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </PageContainer>
  )
}

/** Single pending invitation row with revoke action */
function PendingInvitationRow({ invitation }: { invitation: { id: string; emailAddress: string; role: string; status: string } }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const revokeMutation = useMutation({
    mutationFn: () => api.team.revokeInvitation(invitation.id),
    onSuccess: () => {
      toast.success(t('team.revokeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
    },
  })

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{invitation.emailAddress}</p>
          <p className="text-xs text-muted-foreground">
            {invitation.role === 'org:admin' ? t('team.admin') : t('team.member')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {t('team.pendingInvite')}
        </Badge>
        <button
          onClick={() => revokeMutation.mutate()}
          disabled={revokeMutation.isPending}
          className="text-xs text-destructive hover:underline disabled:opacity-50"
        >
          {t('team.revokeInvite')}
        </button>
      </div>
    </div>
  )
}
