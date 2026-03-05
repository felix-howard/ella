/**
 * Member Profile Page
 * Route: /team/profile/:staffId
 * Self = edit mode, Admin viewing others = read-only
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, User } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { PageContainer } from '../../../components/layout'
import { ProfileForm } from '../../../components/profile/profile-form'
import { AssignedClientsList } from '../../../components/profile/assigned-clients-list'
import { AvatarUploader } from '../../../components/profile/avatar-uploader'
import { api } from '../../../lib/api-client'

export const Route = createFileRoute('/team/profile/$staffId')({
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  const { staffId } = Route.useParams()

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['team-member-profile', staffId],
    queryFn: () => api.team.getProfile(staffId),
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

  const { staff, assignedClients, assignedCount, canEdit } = data

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
            <span className={cn(
              'inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full',
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form - 2/3 width on desktop */}
        <div className="lg:col-span-2">
          <ProfileForm
            staff={staff}
            canEdit={canEdit}
            staffId={staffId}
          />
        </div>

        {/* Assigned Clients - 1/3 width on desktop */}
        <div className="lg:col-span-1">
          <AssignedClientsList
            clients={assignedClients}
            totalCount={assignedCount}
            isAdmin={staff.role === 'ADMIN'}
          />
        </div>
      </div>
    </PageContainer>
  )
}
