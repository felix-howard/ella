import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

export function useTermsStatus() {
  return useQuery({
    queryKey: ['terms-status'],
    queryFn: () => api.terms.getStatus(),
    staleTime: 5 * 60 * 1000,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })
}

export function useAcceptTerms() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.terms.accept,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-status'] })
      queryClient.invalidateQueries({ queryKey: ['terms-acceptance'] })
    },
  })
}

export function useTermsDownload(acceptanceId: string | null) {
  return useQuery({
    queryKey: ['terms-download', acceptanceId],
    queryFn: () => api.terms.getDownloadUrl(acceptanceId!),
    enabled: !!acceptanceId,
  })
}
