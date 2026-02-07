/**
 * Schedule E Hook - Fetches Schedule E rental property data for staff view
 * Includes expense data, magic link status, and calculated totals
 */
import { useQuery } from '@tanstack/react-query'
import { api, type ScheduleEResponse } from '../lib/api-client'

interface UseScheduleEOptions {
  caseId: string | undefined
  enabled?: boolean
}

export function useScheduleE({ caseId, enabled = true }: UseScheduleEOptions) {
  const {
    data: scheduleEData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['schedule-e', caseId],
    queryFn: () => api.scheduleE.get(caseId!),
    enabled: !!caseId && enabled,
    staleTime: 30000, // 30 seconds
  })

  return {
    expense: scheduleEData?.expense ?? null,
    magicLink: scheduleEData?.magicLink ?? null,
    totals: scheduleEData?.totals ?? null,
    properties: scheduleEData?.expense?.properties ?? [],
    isLoading,
    error,
    refetch,
  }
}
