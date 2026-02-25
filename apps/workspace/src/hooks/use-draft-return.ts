/**
 * Draft Return Hook - Fetches draft return data for workspace tab
 * Handles caching and refetching for the Draft Return tab
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

interface UseDraftReturnOptions {
  caseId: string | undefined
  enabled?: boolean
}

export function useDraftReturn({ caseId, enabled = true }: UseDraftReturnOptions) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['draft-return', caseId],
    queryFn: () => api.draftReturns.get(caseId!),
    enabled: !!caseId && enabled,
    staleTime: 30000, // Cache for 30s
  })

  return {
    draftReturn: data?.draftReturn ?? null,
    magicLink: data?.magicLink ?? null,
    versions: data?.versions ?? [],
    isLoading,
    error,
    refetch,
  }
}
