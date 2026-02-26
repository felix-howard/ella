/**
 * Team Member Table - Displays org members with role badges, client count, and actions
 * Admin can change roles, view assignments, and deactivate members
 */
import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { MoreHorizontal, Shield, Users, ChevronDown, ChevronUp, Loader2, UserMinus, ArrowRight } from 'lucide-react'
import { cn, Badge, Button } from '@ella/ui'
import { api, type TeamMember, type OrgRole } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { getInitials, getAvatarColor } from '../../lib/formatters'
import { MemberAssignmentsPanel } from './member-assignments-panel'
import { TeamMemberTableSkeleton } from './team-member-table-skeleton'

interface TeamMemberTableProps {
  members: TeamMember[]
  isLoading?: boolean
  isError?: boolean
}

export function TeamMemberTable({ members, isLoading, isError }: TeamMemberTableProps) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) return <TeamMemberTableSkeleton />

  if (isError) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-sm text-destructive">{t('team.errorLoad')}</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">{t('team.emptyMembers')}</h3>
        <p className="text-sm text-muted-foreground">{t('team.emptyMembersHint')}</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <table className="w-full text-sm" aria-label={t('team.title')}>
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('team.name')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">{t('team.email')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('team.role')}</th>
            <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-3">{t('team.assignedClients')}</th>
            <th scope="col" className="w-10"><span className="sr-only">{t('common.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, i) => (
            <MemberRow
              key={member.id}
              member={member}
              isLast={i === members.length - 1}
              isExpanded={expandedId === member.id}
              onToggleExpand={() => setExpandedId(expandedId === member.id ? null : member.id)}
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
  isExpanded: boolean
  onToggleExpand: () => void
}

const MemberRow = memo(function MemberRow({ member, isLast, isExpanded, onToggleExpand }: MemberRowProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showActions, setShowActions] = useState(false)
  const avatarColor = getAvatarColor(member.name)
  const isAdmin = member.role === 'ADMIN'

  // Navigate to profile when row is clicked (avoid interactive elements)
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('[role="menu"]') ||
      target.closest('[aria-expanded]')
    ) {
      return
    }
    navigate({ to: '/team/profile/$staffId', params: { staffId: member.id } })
  }

  // Role change mutation
  const roleChangeMutation = useMutation({
    mutationFn: (newRole: OrgRole) => api.team.updateRole(member.id, newRole),
    onSuccess: () => {
      toast.success(t('team.roleChangeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setShowActions(false)
    },
  })

  // Remove member mutation (removes from Clerk org + deactivates in DB)
  const removeMutation = useMutation({
    mutationFn: () => api.team.deactivate(member.id),
    onSuccess: () => {
      toast.success(t('team.removeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setShowActions(false)
    },
  })

  return (
    <>
      <tr
        onClick={handleRowClick}
        className={cn(
          !isLast && !isExpanded && 'border-b border-border',
          'hover:bg-muted/50 transition-colors cursor-pointer group'
        )}
      >
        {/* Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', avatarColor.bg, avatarColor.text)}>
                <span className="font-semibold text-sm">{getInitials(member.name)}</span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{member.name}</p>
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
          <button
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={isExpanded}
            aria-label={t('team.viewAssignments')}
          >
            <Users className="w-3.5 h-3.5" />
            {member._count.clientAssignments}
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label={t('common.actions')}
            aria-expanded={showActions}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>

          {showActions && (
            <>
              {/* Backdrop to close menu */}
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-4 top-12 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]" role="menu">
                <button
                  onClick={() => {
                    const newRole = isAdmin ? 'org:member' : 'org:admin'
                    roleChangeMutation.mutate(newRole)
                  }}
                  disabled={roleChangeMutation.isPending}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                >
                  {roleChangeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t('team.changeRole')} → {isAdmin ? t('team.member') : t('team.admin')}
                </button>
                <button
                  onClick={onToggleExpand}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {t('team.viewAssignments')}
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    if (confirm(t('team.confirmRemove', { name: member.name }))) {
                      removeMutation.mutate()
                    }
                  }}
                  disabled={removeMutation.isPending}
                  className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                >
                  {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                  {t('team.removeFromOrg')}
                </button>
              </div>
            </>
          )}
        </td>
      </tr>

      {/* Expanded assignments panel */}
      {isExpanded && (
        <tr className={cn(!isLast && 'border-b border-border')}>
          <td colSpan={5} className="px-4 py-3 bg-muted/20">
            <MemberAssignmentsPanel staffId={member.id} staffName={member.name} isAdmin={isAdmin} />
          </td>
        </tr>
      )}
    </>
  )
})

