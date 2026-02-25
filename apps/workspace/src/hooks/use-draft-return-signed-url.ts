/**
 * useDraftReturnSignedUrl - Hook to fetch signed URL for draft return PDF
 * Used for thumbnail preview and PDF viewing
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

interface UseDraftReturnSignedUrlOptions {
  enabled?: boolean
}

/**
 * Get signed URL for current draft return (for thumbnail preview)
 */
export function useDraftReturnSignedUrl(
  draftId: string | null,
  options: UseDraftReturnSignedUrlOptions = {}
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: ['draft-return-signed-url', draftId],
    queryFn: () => api.draftReturns.getSignedUrl(draftId!),
    enabled: enabled && !!draftId,
    staleTime: 10 * 60 * 1000, // 10 minutes (URL valid for 15 min)
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  })
}

/**
 * Get signed URL for a specific version of draft return
 */
export function useDraftVersionSignedUrl(
  caseId: string | null,
  version: number | null,
  options: UseDraftReturnSignedUrlOptions = {}
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: ['draft-version-signed-url', caseId, version],
    queryFn: () => api.draftReturns.getVersionSignedUrl(caseId!, version!),
    enabled: enabled && !!caseId && version !== null && version > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
