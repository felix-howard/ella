/**
 * Client Managed By - Shows and allows changing managing staff members.
 * Admin: checklist dropdown with avatars to select managers.
 * Member: read-only manager list.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type StaffManagerSummary } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { ManagerList, ManagerSummary } from './client-manager-display'
import { ClientManagerMenu } from './client-manager-menu'

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
  const [localSelection, setLocalSelection] = useState<{
    clientId: string
    staffIds: string[]
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const archivedLabel = t('team.archived', 'Archived')
  const changeManagedByLabel = t('clientOverview.changeManagedBy')

  const assignedStaff = useMemo(
    () =>
      managedByStaff && managedByStaff.length > 0 ? managedByStaff : managedBy ? [managedBy] : [],
    [managedByStaff, managedBy]
  )
  const serverStaffIds = useMemo(() => assignedStaff.map((staff) => staff.id), [assignedStaff])
  const selectedStaffIds =
    localSelection?.clientId === clientId ? localSelection.staffIds : serverStaffIds

  const { data: membersData } = useQuery({
    queryKey: ['assignable-staff'],
    queryFn: () => api.staff.listAssignable(),
    enabled: canManageClients,
  })

  const members = useMemo(() => membersData?.data ?? [], [membersData?.data])
  const assignableStaffIds = useMemo(() => new Set(members.map((member) => member.id)), [members])
  const unavailableAssignedStaff = useMemo(
    () =>
      canManageClients && membersData
        ? assignedStaff.filter(
            (staff) => staff.isActive === false || !assignableStaffIds.has(staff.id)
          )
        : [],
    [assignedStaff, assignableStaffIds, canManageClients, membersData]
  )
  const toAssignableStaffIds = (staffIds: string[]) =>
    membersData ? staffIds.filter((staffId) => assignableStaffIds.has(staffId)) : staffIds
  const selectedStaff = selectedStaffIds
    .map(
      (id) =>
        members.find((member) => member.id === id) ?? assignedStaff.find((staff) => staff.id === id)
    )
    .filter((staff): staff is StaffManagerSummary => Boolean(staff))

  const changeMutation = useMutation({
    mutationFn: (staffIds: string[]) =>
      api.clients.updateManagedBy(clientId, toAssignableStaffIds(staffIds)),
    onMutate: (nextStaffIds) => {
      const previousStaffIds = selectedStaffIds
      const assignableNextStaffIds = toAssignableStaffIds(nextStaffIds)
      setLocalSelection({ clientId, staffIds: assignableNextStaffIds })
      return { previousStaffIds, assignableNextStaffIds }
    },
    onSuccess: async (_data, nextStaffIds, context) => {
      toast.success(t('clientOverview.managedByUpdated'))
      const savedStaffIds = context?.assignableNextStaffIds ?? toAssignableStaffIds(nextStaffIds)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        ...Array.from(new Set([...(context?.previousStaffIds ?? []), ...savedStaffIds])).map(
          (staffId) => queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
        ),
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
                <ManagerSummary managers={selectedStaff} archivedLabel={archivedLabel} />
              ) : (
                <span className="text-sm text-muted-foreground">{changeManagedByLabel}</span>
              )}
            </span>
            <span className="flex items-center gap-1 pt-1">
              {changeMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </span>
          </button>

          {isOpen && (
            <ClientManagerMenu
              members={members}
              unavailableAssignedStaff={unavailableAssignedStaff}
              selectedStaffIds={selectedStaffIds}
              archivedLabel={archivedLabel}
              changeManagedByLabel={changeManagedByLabel}
              isPending={changeMutation.isPending}
              onToggle={handleToggle}
            />
          )}
        </div>
      ) : (
        // Non-admin: read-only display
        <div>
          {assignedStaff.length > 0 ? (
            <ManagerList managers={assignedStaff} archivedLabel={archivedLabel} />
          ) : (
            <span className="text-sm text-muted-foreground">{t('clientOverview.noManagedBy')}</span>
          )}
        </div>
      )}
    </div>
  )
}
