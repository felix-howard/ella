import { useTranslation } from 'react-i18next'
import { Badge, cn } from '@ella/ui'
import type { StaffProfile } from '../../lib/api-client'
import { AvatarUploader } from './avatar-uploader'

interface StaffProfileHeaderCardProps {
  staff: StaffProfile
  staffId: string
  canEdit: boolean
}

export function StaffProfileHeaderCard({ staff, staffId, canEdit }: StaffProfileHeaderCardProps) {
  const { t } = useTranslation()
  const roleLabel = staff.role === 'ADMIN'
    ? t('team.admin')
    : staff.role === 'MANAGER'
      ? t('team.manager')
      : staff.role === 'CPA'
        ? t('team.cpa', 'CPA')
        : t('team.member')

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-5">
        <AvatarUploader
          staffId={staffId}
          currentAvatarUrl={staff.avatarUrl}
          name={staff.name}
          canEdit={canEdit}
        />

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{staff.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{staff.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              {roleLabel}
            </span>
            {staff.isContractorAgent && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950/30">
                {t('team.contractorAgent', 'Contractor Agent')}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
