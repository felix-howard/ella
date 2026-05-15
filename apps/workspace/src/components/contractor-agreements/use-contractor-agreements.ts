import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

function shouldRetryStatus(failureCount: number, error: Error) {
  if ('status' in error && (error.status === 401 || error.status === 403)) {
    return false
  }
  return failureCount < 5
}

export function useContractorAgreementStatus(enabled = true) {
  return useQuery({
    queryKey: ['contractor-agreement-status'],
    queryFn: () => api.contractorAgreements.getStatus(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryStatus,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })
}

export function useAcceptContractorAgreement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.contractorAgreements.accept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-agreement-status'] })
      queryClient.invalidateQueries({ queryKey: ['contractor-agreement-acceptance'] })
    },
  })
}

export function useContractorAgreementDownload(acceptanceId: string | null) {
  return useQuery({
    queryKey: ['contractor-agreement-download', acceptanceId],
    queryFn: () => api.contractorAgreements.getDownloadUrl(acceptanceId!),
    enabled: !!acceptanceId,
  })
}
