/**
 * Member Profile Page
 * Route: /team/profile/:staffId
 * Self = edit mode, Admin viewing others = read-only with role selector + archive
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, User, Archive, ArchiveRestore, AlertTriangle } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { PageContainer } from '../../../components/layout'
import { ProfileForm } from '../../../components/profile/profile-form'
import { AssignedClientsList } from '../../../components/profile/assigned-clients-list'
import { AvatarUploader } from '../../../components/profile/avatar-uploader'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'

export const Route = createFileRoute('/team/profile/$staffId')({
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  const { staffId } = Route.useParams()
  const { isAdmin: isCurrentUserAdmin, staffId: currentUserStaffId } = useOrgRole()
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['team-member-profile', staffId],
    queryFn: () => api.team.getProfile(staffId),
  })

  // Role change mutation
  const roleMutation = useMutation({
    mutationFn: (newRole: 'org:admin' | 'org:member') =>
      api.team.updateRole(staffId, newRole),
    onSuccess: () => {
      toast.success(t('team.roleChangeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('team.roleChangeFailed'))
    },
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => api.team.archive(staffId),
    onSuccess: () => {
      toast.success(t('team.archiveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('team.archiveFailed'))
    },
  })

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: () => api.team.unarchive(staffId),
    onSuccess: () => {
      toast.success(t('team.unarchiveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('team.unarchiveFailed'))
    },
  })

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
  const canChangeRole = isCurrentUserAdmin && staffId !== currentUserStaffId && staff.isActive
  // Show archive/unarchive only if: admin, viewing other member
  const canArchive = isCurrentUserAdmin && staffId !== currentUserStaffId
  const isArchived = !staff.isActive

  return (
    <PageContainer>
      {/* Back Link */}
      <Link
        to="/team"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('profile.backToTeam')}
      </Link>

      {/* Archived Banner */}
      {isArchived && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('team.archivedMemberBanner')}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {t('team.archivedMemberBannerDesc')}
            </p>
          </div>
          {canArchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              {unarchiveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArchiveRestore className="w-4 h-4 mr-1.5" />
              )}
              {t('team.unarchive')}
            </Button>
          )}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-card rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-5">
          {/* Avatar with uploader */}
          <AvatarUploader
            staffId={staffId}
            currentAvatarUrl={staff.avatarUrl}
            name={staff.name}
            canEdit={canEdit}
          />

          {/* Name & Meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{staff.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{staff.email}</p>
            <div className="mt-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full',
                staff.role === 'ADMIN'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  staff.role === 'ADMIN' ? 'bg-primary' : 'bg-muted-foreground'
                )} />
                {staff.role === 'ADMIN' ? t('team.admin') : t('team.member')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form - 2/3 width on desktop */}
        <div className="lg:col-span-2">
          <ProfileForm
            staff={staff}
            canEdit={canEdit}
            staffId={staffId}
            canChangeRole={canChangeRole}
            onRoleChange={(role) => roleMutation.mutate(role)}
            isRoleChangePending={roleMutation.isPending}
            hideNotifications
          />
        </div>

        {/* Assigned Clients - 1/3 width on desktop */}
        <div className="lg:col-span-1">
          <AssignedClientsList
            clients={managedClients}
            totalCount={managedCount}
          />
        </div>
      </div>

      {/* Archive Section - Admin viewing active other member */}
      {canArchive && !isArchived && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('team.dangerZone')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('team.archiveDescription')}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm(t('team.confirmArchive', { name: staff.name }))) {
                  archiveMutation.mutate()
                }
              }}
              disabled={archiveMutation.isPending}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {archiveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Archive className="w-4 h-4 mr-2" />
              )}
              {t('team.archiveMember')}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
