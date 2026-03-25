/**
 * Settings Profile Tab - Edit current user's profile
 * Fetches staffId='me' and renders avatar + profile form
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, User } from 'lucide-react'
import { ProfileForm } from '../profile/profile-form'
import { AvatarUploader } from '../profile/avatar-uploader'
import { api } from '../../lib/api-client'
import { useOrgRole } from '../../hooks/use-org-role'

export function SettingsProfileTab() {
  const { t } = useTranslation()
  const _orgRole = useOrgRole()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-member-profile', 'me'],
    queryFn: () => api.team.getProfile('me'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <User className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">{t('profile.notFound')}</h3>
      </div>
    )
  }

  const { staff, canEdit } = data

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-card rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-5">
          <AvatarUploader
            staffId="me"
            currentAvatarUrl={staff.avatarUrl}
            name={staff.name}
            canEdit={canEdit}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">{staff.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{staff.email}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <ProfileForm
        staff={staff}
        canEdit={canEdit}
        staffId="me"
        canChangeRole={false}
        hideNotifications
      />
    </div>
  )
}
