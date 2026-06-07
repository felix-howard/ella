/**
 * Client Managed By - Shows and allows changing managing staff members.
 * Admin: checklist dropdown with avatars to select managers.
 * Member: read-only manager list.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, Loader2, ChevronDown, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type StaffManagerSummary } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

interface ClientManagedByProps {
  clientId: string
  managedByStaff?: StaffManagerSummary[]
  managedBy?: StaffManagerSummary | null
}

export function ClientAssignedStaff({ clientId, managedByStaff, managedBy }: ClientManagedByProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { canManageClients } = useOrgRole()
  const [isOpen, setIsOpen] = useState(false)
  const [localSelection, setLocalSelection] = useState<{ clientId: string; staffIds: string[] } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const assignedStaff = useMemo(
    () => managedByStaff && managedByStaff.length > 0 ? managedByStaff : managedBy ? [managedBy] : [],
    [managedByStaff, managedBy]
  )
  const serverStaffIds = useMemo(() => assignedStaff.map((staff) => staff.id), [assignedStaff])
  const selectedStaffIds = localSelection?.clientId === clientId ? localSelection.staffIds : serverStaffIds

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: canManageClients,
  })

  const members = (membersData?.data ?? []).filter((member) => member.isActive !== false)
  const selectedStaff = selectedStaffIds
    .map((id) => members.find((member) => member.id === id) ?? assignedStaff.find((staff) => staff.id === id))
    .filter((staff): staff is StaffManagerSummary => Boolean(staff))

  const changeMutation = useMutation({
    mutationFn: (staffIds: string[]) => api.clients.updateManagedBy(clientId, staffIds),
    onMutate: (nextStaffIds) => {
      const previousStaffIds = selectedStaffIds
      setLocalSelection({ clientId, staffIds: nextStaffIds })
      return { previousStaffIds }
    },
    onSuccess: async (_data, nextStaffIds, context) => {
      toast.success(t('clientOverview.managedByUpdated'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        ...Array.from(new Set([...(context?.previousStaffIds ?? []), ...nextStaffIds]))
          .map((staffId) => queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })),
      ])
      setLocalSelection(null)
    },
    onError: (_error, _nextStaffIds, context) => {
      setLocalSelection(context ? { clientId, staffIds: context.previousStaffIds } : null)
      toast.error(t('clientOverview.managedByUpdateFailed'))
    },
  })

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  function handleToggle(staffId: string) {
    const nextStaffIds = selectedStaffIds.includes(staffId)
      ? selectedStaffIds.filter((id) => id !== staffId)
      : [...selectedStaffIds, staffId]
    changeMutation.mutate(nextStaffIds)
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {t('clientOverview.managedBy')}
      </h3>

      {/* Admin: custom dropdown with avatars */}
      {canManageClients && members.length > 0 ? (
        <div ref={containerRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls="client-manager-menu"
            onClick={() => !changeMutation.isPending && setIsOpen(!isOpen)}
            disabled={changeMutation.isPending}
            className={cn(
              'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-left',
              'flex items-start justify-between gap-3 min-h-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-colors',
              changeMutation.isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {selectedStaff.length > 0 ? (
                <ManagerSummary managers={selectedStaff} />
              ) : (
                <span className="text-sm text-muted-foreground">{t('clientOverview.changeManagedBy')}</span>
              )}
            </span>
            <span className="flex items-center gap-1 pt-1">
              {changeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </span>
          </button>

          {isOpen && (
            <div
              id="client-manager-menu"
              role="menu"
              className="absolute z-[9999] w-full mt-1 py-1 rounded-lg border bg-card border-border shadow-lg max-h-60 overflow-auto"
            >
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                {t('clientOverview.changeManagedBy')}
              </div>
              {members.map((m) => {
                const isSelected = selectedStaffIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!changeMutation.isPending) handleToggle(m.id)
                    }}
                    disabled={changeMutation.isPending}
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm',
                      'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary transition-colors',
                      'flex items-center justify-between gap-2',
                      isSelected && 'bg-primary/10',
                      changeMutation.isPending && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StaffAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                      <span className="truncate text-foreground">{m.name}</span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // Non-admin: read-only display
        <div>
          {assignedStaff.length > 0 ? (
            <ManagerList managers={assignedStaff} />
          ) : (
            <span className="text-sm text-muted-foreground">{t('clientOverview.noManagedBy')}</span>
          )}
        </div>
      )}
    </div>
  )
}

function ManagerSummary({ managers }: { managers: StaffManagerSummary[] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {managers.map((manager) => (
        <span
          key={manager.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/70 px-2 py-1 text-sm font-medium text-foreground"
        >
          <StaffAvatar name={manager.name} avatarUrl={manager.avatarUrl ?? null} size="sm" />
          <span className="min-w-0 whitespace-normal break-words leading-snug">{manager.name}</span>
        </span>
      ))}
    </span>
  )
}

function ManagerList({ managers }: { managers: StaffManagerSummary[] }) {
  return (
    <div className="space-y-2">
      {managers.map((manager) => (
        <div key={manager.id} className="flex items-center gap-2">
          <StaffAvatar name={manager.name} avatarUrl={manager.avatarUrl ?? null} size="sm" />
          <span className="min-w-0 truncate text-sm text-foreground">{manager.name}</span>
        </div>
      ))}
    </div>
  )
}

function StaffAvatar({ name, avatarUrl, size = 'sm' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  const avatarColor = getAvatarColor(name)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(sizeClass, 'rounded-full object-cover')}
      />
    )
  }

  return (
    <span className={cn(sizeClass, 'rounded-full flex items-center justify-center font-medium', avatarColor.bg, avatarColor.text)}>
      {getInitials(name)}
    </span>
  )
}
