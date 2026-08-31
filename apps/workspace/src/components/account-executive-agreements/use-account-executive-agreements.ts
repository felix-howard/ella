import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

function shouldRetryStatus(failureCount: number, error: Error) {
  if ('status' in error && (error.status === 401 || error.status === 403)) {
    return false
  }
  return failureCount < 5
}

export function useAccountExecutiveAgreementStatus(enabled = true) {
  return useQuery({
    queryKey: ['account-executive-agreement-status'],
    queryFn: () => api.accountExecutiveAgreements.getStatus(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryStatus,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })
}

export function useAcceptAccountExecutiveAgreement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.accountExecutiveAgreements.accept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-executive-agreement-status'] })
      queryClient.invalidateQueries({ queryKey: ['account-executive-agreement-acceptance'] })
    },
  })
}
