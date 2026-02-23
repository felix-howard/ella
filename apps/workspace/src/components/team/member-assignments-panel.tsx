/**
 * Member Assignments Panel - Shows client assignments for a staff member
 * Displayed as expandable row in team table. Allows unassign and bulk assign.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Loader2, UserMinus } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type ClientAssignment } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { BulkAssignDialog } from './bulk-assign-dialog'

interface MemberAssignmentsPanelProps {
  staffId: string
  staffName: string
  isAdmin?: boolean
}

export function MemberAssignmentsPanel({ staffId, staffName, isAdmin }: MemberAssignmentsPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['member-assignments', staffId],
    queryFn: () => api.team.getMemberAssignments(staffId),
    // Skip fetching assignments for admins - they have access to all clients
    enabled: !isAdmin,
  })

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => api.clientAssignments.remove(assignmentId),
    onSuccess: () => {
      toast.success(t('team.unassignSuccess'))
      queryClient.invalidateQueries({ queryKey: ['member-assignments', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })

  const assignments = data?.data ?? []

  if (isLoading && !isAdmin) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  // Admin has access to all clients - show message instead of assignments
  if (isAdmin) {
    return (
      <div className="py-2">
        <p className="text-sm text-muted-foreground py-2">
          {t('team.adminAllClientsAccess')}
        </p>
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-foreground">
          {t('team.assignedClients')} ({assignments.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setIsBulkAssignOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('team.assignClients')}
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('team.emptyAssignments')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignments.map((assignment) => (
            <AssignmentChip
              key={assignment.id}
              assignment={assignment}
              onUnassign={() => unassignMutation.mutate(assignment.id)}
              isRemoving={unassignMutation.isPending}
            />
          ))}
        </div>
      )}

      <BulkAssignDialog
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        staffId={staffId}
        staffName={staffName}
        existingAssignments={assignments}
      />
    </div>
  )
}

/** Compact chip for a single client assignment with unassign button */
function AssignmentChip({
  assignment,
  onUnassign,
  isRemoving,
}: {
  assignment: ClientAssignment
  onUnassign: () => void
  isRemoving: boolean
}) {
  return (
    <div className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-muted text-sm">
      <span className="text-foreground">{assignment.client?.name ?? 'Unknown'}</span>
      <button
        onClick={onUnassign}
        disabled={isRemoving}
        className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        aria-label={`Unassign ${assignment.client?.name ?? 'client'}`}
        title="Unassign"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
