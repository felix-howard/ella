/**
 * Member Profile Page
 * Route: /team/profile/:staffId
 * Self = edit mode, Admin viewing others = read-only with role selector + archive
 */
import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, User, ArchiveRestore, AlertTriangle } from 'lucide-react'
import { Button } from '@ella/ui'
import { PageContainer } from '../../../components/layout'
import { StaffProfileHeaderCard } from '../../../components/profile/staff-profile-header-card'
import { StaffProfileTabs } from '../../../components/profile/staff-profile-tabs'
import { api, type AppRole } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'

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
  const { canManageTeam, staffId: currentUserStaffId } = useOrgRole()
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['team-member-profile', staffId],
    queryFn: () => api.team.getProfile(staffId),
  })

  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  // Role change mutation (app-level role: ADMIN | MANAGER | MEMBER)
  const roleMutation = useMutation({
    mutationFn: (newRole: AppRole) =>
      api.team.updateRole(staffId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
    },
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => api.team.archive(staffId),
    onSuccess: () => {
      toast.success(t('team.archiveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
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
      queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('team.unarchiveFailed'))
    },
  })

  const profileStaff = data?.staff
  const isOwnProfile = Boolean(profileStaff && (profileStaff.id === currentUserStaffId || staffId === 'me'))

  useEffect(() => {
    if (!focus || !isOwnProfile) return

    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-settings-focus="${focus}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const ringClasses = ['ring-2', 'ring-primary', 'ring-offset-2']
      el.classList.add(...ringClasses)
      window.setTimeout(() => {
        el.classList.remove(...ringClasses)
      }, 2000)
    })

    return () => window.cancelAnimationFrame(id)
  }, [focus, isOwnProfile])

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
  // Show archive/unarchive only if: admin, viewing other member
  const canArchive = canManageTeam && !isOwnProfile
  const isArchived = !staff.isActive

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

      <StaffProfileHeaderCard staff={staff} staffId={staffId} canEdit={canEdit} />

      <StaffProfileTabs
        staff={staff}
        staffId={staffId}
        managedClients={managedClients}
        managedCount={managedCount}
        canEdit={canEdit}
        canChangeRole={canChangeRole}
        canManageTeam={canManageTeam}
        isOwnProfile={isOwnProfile}
        canArchive={canArchive}
        isArchived={isArchived}
        orgSettings={orgSettings}
        onRoleChange={async (role) => {
          await roleMutation.mutateAsync(role)
        }}
        isRoleChangePending={roleMutation.isPending}
        onArchive={() => {
          if (confirm(t('team.confirmArchive', { name: staff.name }))) {
            archiveMutation.mutate()
          }
        }}
        isArchivePending={archiveMutation.isPending}
      />
    </PageContainer>
  )
}
