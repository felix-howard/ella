/**
 * Client Assigned Staff - Horizontal badge list with assign/unassign
 */
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

interface ClientAssignedStaffProps {
  clientId: string
}

export function ClientAssignedStaff({ clientId }: ClientAssignedStaffProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isAdmin } = useOrgRole()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['client-assignments', clientId],
    queryFn: () => api.clientAssignments.list({ clientId }),
  })

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isDropdownOpen && isAdmin,
  })

  const assignments = assignmentsData?.data ?? []
  const members = membersData?.data ?? []
  const assignedStaffIds = new Set(assignments.map((a) => a.staffId))
  const availableMembers = members.filter((m) => !assignedStaffIds.has(m.id) && m.role !== 'ADMIN')

  const assignMutation = useMutation({
    mutationFn: (staffId: string) => api.clientAssignments.create({ clientId, staffId }),
    onSuccess: () => {
      toast.success(t('clientOverview.staffAssigned'))
      setIsDropdownOpen(false)
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
    },
    onError: () => {
      toast.error(t('clientOverview.staffAssignFailed'))
    },
  })

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => api.clientAssignments.remove(assignmentId),
    onSuccess: () => {
      toast.success(t('clientOverview.staffUnassigned'))
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
    },
    onError: () => {
      toast.error(t('clientOverview.staffUnassignFailed'))
    },
  })

  if (!isAdmin) {
    // Non-admin: show read-only list
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {t('clientOverview.assignedStaff')}
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('clientOverview.noAssignedStaff')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignments.map((a) => (
              <StaffBadge key={a.id} name={a.staff?.name ?? 'Unknown'} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {t('clientOverview.assignedStaff')}
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            {assignments.map((a) => (
              <StaffBadge
                key={a.id}
                name={a.staff?.name ?? 'Unknown'}
                onRemove={() => unassignMutation.mutate(a.id)}
                isRemoving={unassignMutation.isPending}
              />
            ))}
            {assignments.length === 0 && (
              <span className="text-sm text-muted-foreground">{t('clientOverview.noAssignedStaff')}</span>
            )}
          </>
        )}

        {/* Add button */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1.5 rounded-full border border-dashed border-border hover:border-primary hover:bg-muted transition-colors"
            aria-label={t('clientOverview.assignStaff')}
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>

          {isDropdownOpen && (
            <AssignDropdown
              members={availableMembers}
              onSelect={(staffId) => assignMutation.mutate(staffId)}
              onClose={() => setIsDropdownOpen(false)}
              isAssigning={assignMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StaffBadge({
  name,
  onRemove,
  isRemoving,
}: {
  name: string
  onRemove?: () => void
  isRemoving?: boolean
}) {
  const avatarColor = getAvatarColor(name)

  return (
    <span className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-muted text-sm">
      <span className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
        avatarColor.bg,
        avatarColor.text
      )}>
        {getInitials(name)}
      </span>
      <span className="text-foreground">{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remove ${name}`}
        >
          {isRemoving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </button>
      )}
    </span>
  )
}

function AssignDropdown({
  members,
  onSelect,
  onClose,
  isAssigning,
}: {
  members: { id: string; name: string; avatarUrl: string | null }[]
  onSelect: (staffId: string) => void
  onClose: () => void
  isAssigning: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-56 py-1 rounded-lg border border-border bg-card shadow-lg z-50 max-h-60 overflow-auto"
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
        {t('clientOverview.selectStaff')}
      </div>
      {members.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {t('clientOverview.noAvailableStaff')}
        </div>
      ) : (
        members.map((m) => {
          const avatarColor = getAvatarColor(m.name)
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              disabled={isAssigning}
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  avatarColor.bg,
                  avatarColor.text
                )}>
                  {getInitials(m.name)}
                </span>
              )}
              {m.name}
            </button>
          )
        })
      )}
    </div>
  )
}
