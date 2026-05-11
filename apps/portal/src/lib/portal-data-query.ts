import { useQuery } from '@tanstack/react-query'
import { portalApi } from './api-client'

export const portalDataQueryKey = (token: string) => ['portal-data', token] as const

export function usePortalDataQuery(token: string) {
  return useQuery({
    queryKey: portalDataQueryKey(token),
    queryFn: () => portalApi.getData(token),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  })
}
