/**
 * Reusable hook + query key for the NDA setup readiness check. Centralised so
 * settings mutations can invalidate the cache without importing wizard internals.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

import type { AgreementType } from '../../lib/api-client'

export const ndaReadinessQueryKey = (type: 'NDA' | 'ENGAGEMENT_LETTER' = 'NDA') =>
  ['nda-readiness', type] as const

export type NdaReadinessMissing = 'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw' | 'orgContact'

export interface NdaReadiness {
  ready: boolean
  missing: NdaReadinessMissing[]
}

export function useNdaReadiness(type: Extract<AgreementType, 'NDA' | 'ENGAGEMENT_LETTER'> = 'NDA', enabled = true) {
  return useQuery<NdaReadiness>({
    queryKey: ndaReadinessQueryKey(type),
    queryFn: () => api.staff.getNdaReadiness({ type }),
    enabled,
    staleTime: 0,
  })
}

export function useInvalidateNdaReadiness() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['nda-readiness'] })
}
