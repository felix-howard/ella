/**
 * Reusable hook + query key for the NDA setup readiness check. Centralised so
 * settings mutations can invalidate the cache without importing wizard internals.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

export const ndaReadinessQueryKey = ['nda-readiness'] as const

export type NdaReadinessMissing = 'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw'

export interface NdaReadiness {
  ready: boolean
  missing: NdaReadinessMissing[]
}

export function useNdaReadiness(enabled = true) {
  return useQuery<NdaReadiness>({
    queryKey: ndaReadinessQueryKey,
    queryFn: () => api.staff.getNdaReadiness(),
    enabled,
    staleTime: 0,
  })
}

export function useInvalidateNdaReadiness() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ndaReadinessQueryKey })
}
