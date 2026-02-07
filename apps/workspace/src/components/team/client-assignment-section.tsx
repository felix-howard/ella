/**
 * Client Assignment Section - Shows which staff are assigned to a client
 * Displayed on client detail page (admin only). Allows assign/unassign.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Loader2, Users } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { CustomSelect } from '../ui/custom-select'
import { api, type ClientAssignment, type TeamMember } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface ClientAssignmentSectionProps {
  clientId: string
}

export function ClientAssignmentSection({ clientId }: ClientAssignmentSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedStaffId, setSelectedStaffId] = useState('')

  // Fetch assignments for this client
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['client-assignments', clientId],
    queryFn: () => api.clientAssignments.list({ clientId }),
  })

  // Fetch team members for the assign dropdown
  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
  })

  const assignments = assignmentsData?.data ?? []
  const members = membersData?.data ?? []
  const assignedStaffIds = new Set(assignments.map((a) => a.staffId))
  const availableMembers = members.filter((m) => !assignedStaffIds.has(m.id) && m.role !== 'ADMIN')

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (staffId: string) => api.clientAssignments.create({ clientId, staffId }),
    onSuccess: () => {
      setSelectedStaffId('')
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => api.clientAssignments.remove(assignmentId),
    onSuccess: () => {
      toast.success(t('team.unassignSuccess'))
      queryClient.invalidateQueries({ queryKey: ['client-assignments', clientId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        {t('team.assignedTo')}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current assignments */}
          {assignments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {assignments.map((a) => (
                <div key={a.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-muted text-sm">
                  <span className="text-foreground">{a.staff?.name ?? 'Unknown'}</span>
                  <button
                    onClick={() => unassignMutation.mutate(a.id)}
                    disabled={unassignMutation.isPending}
                    className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={t('team.unassign')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {assignments.length === 0 && (
            <p className="text-sm text-muted-foreground mb-3">{t('team.emptyAssignments')}</p>
          )}

          {/* Add assignment */}
          {availableMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <CustomSelect
                value={selectedStaffId}
                onChange={(value) => setSelectedStaffId(value)}
                options={availableMembers.map((m) => ({ value: m.id, label: m.name }))}
                placeholder={`${t('team.assignClients')}...`}
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                onClick={() => selectedStaffId && assignMutation.mutate(selectedStaffId)}
                disabled={!selectedStaffId || assignMutation.isPending}
                aria-label={t('team.assignClients')}
              >
                {assignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
