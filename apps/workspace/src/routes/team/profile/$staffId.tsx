/**
 * Member Profile Page
 * Route: /team/profile/:staffId
 * Self = edit mode, Admin viewing others = read-only with role selector + access removal
 */
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, User } from 'lucide-react'
import { Button } from '@ella/ui'
import { PageContainer } from '../../../components/layout'
import { StaffAccessStatusBanner } from '../../../components/profile/staff-access-status-banner'
import { StaffProfileHeaderCard } from '../../../components/profile/staff-profile-header-card'
import { StaffProfileTabs } from '../../../components/profile/staff-profile-tabs'
import { useStaffProfileFocus } from '../../../components/profile/use-staff-profile-focus'
import { InviteMemberDialog } from '../../../components/team/invite-member-dialog'
import { RemoveMemberAccessDialog } from '../../../components/team/remove-member-access-dialog'
import { api, type AppRole } from '../../../lib/api-client'
import { canInviteAgain, staffRoleToInviteRole } from '../../../lib/team-reconciliation'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { useTeamMemberReconciliation } from '../../../hooks/use-team-member-reconciliation'

const VALID_FOCUS = ['signature', 'title'] as const
type ProfileFocus = (typeof VALID_FOCUS)[number]

export const Route = createFileRoute('/team/profile/$staffId')({
  validateSearch: (search: Record<string, unknown>): { focus?: ProfileFocus } => {
    const focus = search.focus as string
    return {
      focus: VALID_FOCUS.includes(focus as ProfileFocus) ? (focus as ProfileFocus) : undefined,
    }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  const { staffId } = Route.useParams()
  const { focus } = Route.useSearch()
  const { canManageAnyIntakeLink, canManageTeam, staffId: currentUserStaffId } = useOrgRole()
  const queryClient = useQueryClient()
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['team-member-profile', staffId],
    queryFn: () => api.team.getProfile(staffId),
  })

  const { data: orgSettings, isLoading: isOrgSettingsLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const profileStaff = data?.staff
  const { reconciliationData, membershipStatus } = useTeamMemberReconciliation(
    profileStaff?.id,
    canManageTeam
  )

  // Role change mutation (app-level role: ADMIN | MANAGER | MEMBER)
  const roleMutation = useMutation({
    mutationFn: (newRole: AppRole) =>
      api.team.updateRole(staffId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
      queryClient.invalidateQueries({ queryKey: ['team-reconciliation'] })
    },
  })

  const removeAccessMutation = useMutation({
    mutationFn: () => api.team.removeAccess(profileStaff?.id ?? staffId),
    onSuccess: () => {
      toast.success(t('team.removeAccessSuccess'))
      setIsRemoveDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
      queryClient.invalidateQueries({ queryKey: ['team-reconciliation'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('team.removeAccessFailed'))
    },
  })

  const isOwnProfile = Boolean(profileStaff && (profileStaff.id === currentUserStaffId || staffId === 'me'))
  useStaffProfileFocus(focus, isOwnProfile)

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </PageContainer>
    )
  }

  if (isError || !data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('profile.notFound')}</h3>
          <Link to="/team">
            <Button variant="outline" className="mt-4">
              {t('profile.backToTeam')}
            </Button>
          </Link>
        </div>
      </PageContainer>
    )
  }

  const { staff, managedClients, managedCount, canEdit } = data

  // Show role selector only if: admin, viewing other member, member is active
  const canChangeRole = canManageTeam && !isOwnProfile && staff.isActive
  const isArchived = !staff.isActive
  const canRemoveAccess =
    canManageTeam &&
    !isOwnProfile &&
    (staff.isActive || membershipStatus === 'ARCHIVED_STILL_IN_CLERK')
  const canShowInviteAgain =
    canManageTeam &&
    !isOwnProfile &&
    isArchived &&
    Boolean(reconciliationData) &&
    canInviteAgain(membershipStatus)

  return (
    <PageContainer>
      {/* Back Link */}
      <Link
        to="/team"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('profile.backToTeam')}
      </Link>

      {isArchived && (
        <StaffAccessStatusBanner
          membershipStatus={membershipStatus}
          canInviteAgain={canShowInviteAgain}
          onInviteAgain={() => setIsInviteOpen(true)}
        />
      )}

      <StaffProfileHeaderCard staff={staff} staffId={staffId} canEdit={canEdit} />

      <StaffProfileTabs
        staff={staff}
        staffId={staffId}
        managedClients={managedClients}
        managedCount={managedCount}
        canEdit={canEdit}
        canChangeRole={canChangeRole}
        canManageTeam={canManageTeam}
        canManageAnyIntakeLink={canManageAnyIntakeLink}
        isOwnProfile={isOwnProfile}
        canRemoveAccess={canRemoveAccess}
        orgSettings={orgSettings}
        isOrgSettingsLoading={isOrgSettingsLoading}
        onRoleChange={async (role) => {
          await roleMutation.mutateAsync(role)
        }}
        isRoleChangePending={roleMutation.isPending}
        onRemoveAccess={() => setIsRemoveDialogOpen(true)}
        isRemoveAccessPending={removeAccessMutation.isPending}
      />

      <RemoveMemberAccessDialog
        open={isRemoveDialogOpen}
        staffName={staff.name}
        managedClientCount={managedCount}
        membershipStatus={membershipStatus}
        isPending={removeAccessMutation.isPending}
        onClose={() => setIsRemoveDialogOpen(false)}
        onConfirm={() => removeAccessMutation.mutate()}
      />

      {isInviteOpen && (
        <InviteMemberDialog
          isOpen
          onClose={() => setIsInviteOpen(false)}
          initialEmail={staff.email}
          initialRole={staffRoleToInviteRole(staff.role)}
        />
      )}
    </PageContainer>
  )
}
