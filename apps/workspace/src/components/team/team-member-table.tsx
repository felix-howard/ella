/**
 * Team Member Table - Displays org members with role badges and client count
 * Row click navigates to member profile page
 */
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { Shield, Users, ArrowRight } from 'lucide-react'
import { cn, Badge } from '@ella/ui'
import type { TeamMember } from '../../lib/api-client'
import { getInitials, getAvatarColor } from '../../lib/formatters'
import { TeamMemberTableSkeleton } from './team-member-table-skeleton'

interface TeamMemberTableProps {
  members: TeamMember[]
  isLoading?: boolean
  isError?: boolean
  showArchived?: boolean
}

export function TeamMemberTable({ members, isLoading, isError }: TeamMemberTableProps) {
  const { t } = useTranslation()

  if (isLoading) return <TeamMemberTableSkeleton />

  if (isError) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border/50 p-8 text-center">
        <p className="text-sm text-destructive">{t('team.errorLoad')}</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border/50 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">{t('team.emptyMembers')}</h3>
        <p className="text-sm text-muted-foreground">{t('team.emptyMembersHint')}</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-visible">
      <table className="w-full text-sm" aria-label={t('team.title')}>
        <thead>
          <tr className="border-b border-border/50 bg-muted/50">
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('team.name')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">{t('team.email')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('team.role')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('profile.managedClients')}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, i) => (
            <MemberRow
              key={member.id}
              member={member}
              isLast={i === members.length - 1}
              isArchived={member.isActive === false}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface MemberRowProps {
  member: TeamMember
  isLast: boolean
  isArchived?: boolean
}

const MemberRow = memo(function MemberRow({ member, isLast, isArchived }: MemberRowProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const avatarColor = getAvatarColor(member.name)
  const isAdmin = member.role === 'ADMIN'

  const handleRowClick = () => {
    navigate({ to: '/team/profile/$staffId', params: { staffId: member.id } })
  }

  return (
    <tr
      onClick={handleRowClick}
      className={cn(
        !isLast && 'border-b border-border/40',
        'hover:bg-muted/40 transition-colors duration-150 cursor-pointer group',
        isArchived && 'opacity-50'
      )}
    >
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-background shadow-sm"
            />
          ) : (
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm', avatarColor.bg, avatarColor.text)}>
              <span className="font-semibold text-sm">{getInitials(member.name)}</span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{member.name}</p>
              {isArchived && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                  {t('team.archived')}
                </Badge>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground md:hidden">{member.email}</p>
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-muted-foreground">{member.email}</span>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <Badge variant={isAdmin ? 'default' : 'outline'} className={cn(isAdmin && 'bg-primary/10 text-primary border-primary/30')}>
          <Shield className="w-3 h-3 mr-1" />
          {isAdmin ? t('team.admin') : t('team.member')}
        </Badge>
      </td>

      {/* Client count */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {member._count.managedClients}
        </span>
      </td>
    </tr>
  )
})
