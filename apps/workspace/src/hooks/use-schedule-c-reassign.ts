/**
 * Schedule C Reassign Hook — moves a Schedule C from its current TaxCase to a
 * sibling TaxCase in the same client group + tax year. Invalidates client and
 * schedule-c caches so the UI re-fetches immediately (Phase 3 visibility rules
 * make the source individual's tab disappear and the destination business's
 * tab appear).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'

export interface ReassignVars {
  scheduleCId: string
  targetCaseId: string
}

export function useScheduleCReassign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scheduleCId, targetCaseId }: ReassignVars) =>
      api.scheduleC.reassign(scheduleCId, targetCaseId),
    onSuccess: (resp) => {
      // Invalidate exactly the two clients + two cases the move touches.
      queryClient.invalidateQueries({ queryKey: ['client', resp.fromCase.clientId] })
      queryClient.invalidateQueries({ queryKey: ['client', resp.toCase.clientId] })
      queryClient.invalidateQueries({ queryKey: ['schedule-c', resp.fromCase.id] })
      queryClient.invalidateQueries({ queryKey: ['schedule-c', resp.toCase.id] })
    },
  })
}
