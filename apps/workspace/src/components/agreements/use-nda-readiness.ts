/**
 * Reusable hook + query key for the NDA setup readiness check. Centralised so
 * settings mutations can invalidate the cache without importing wizard internals.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { api } from '../../lib/api-client'

import type { AgreementType } from '../../lib/api-client'

export type NdaReadinessMissing = 'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw' | 'orgContact'

export interface NdaReadiness {
  ready: boolean
  missing: NdaReadinessMissing[]
}

export const ndaReadinessQueryKey = (
  type: 'NDA' | 'ENGAGEMENT_LETTER' = 'NDA',
  orgId?: string | null,
) => ['nda-readiness', orgId ?? 'no-org', type] as const

export function useNdaReadiness(type: Extract<AgreementType, 'NDA' | 'ENGAGEMENT_LETTER'> = 'NDA', enabled = true) {
  const { orgId } = useAuth()
  return useQuery<NdaReadiness>({
    queryKey: ndaReadinessQueryKey(type, orgId),
    queryFn: () => api.staff.getNdaReadiness({ type }),
    enabled: enabled && Boolean(orgId),
    staleTime: 0,
  })
}

export function useInvalidateNdaReadiness() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['nda-readiness'] })
}
