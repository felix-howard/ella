import { useQuery } from '@tanstack/react-query'
import { ApiError, portalApi } from './api-client'

export const portalDataQueryKey = (token: string) => ['portal-data', token] as const

export function usePortalDataQuery(token: string) {
  return useQuery({
    queryKey: portalDataQueryKey(token),
    queryFn: () => portalApi.getData(token),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        ['RATE_LIMITED', 'INVALID_TOKEN', 'EXPIRED_TOKEN'].includes(error.code)
      ) {
        return false
      }
      return failureCount < 2
    },
  })
}
