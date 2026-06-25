import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { buildReconciliationByStaffId } from '../lib/team-reconciliation'

export function useTeamMemberReconciliation(staffId: string | undefined, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['team-reconciliation'],
    queryFn: () => api.team.getReconciliation(),
    enabled,
  })

  const reconciliationByStaffId = useMemo(
    () => buildReconciliationByStaffId(data?.members),
    [data?.members]
  )
  const memberReconciliation = staffId ? reconciliationByStaffId.get(staffId) : undefined

  return {
    reconciliationData: data,
    memberReconciliation,
    membershipStatus: memberReconciliation?.status,
  }
}
