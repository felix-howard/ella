/**
 * useSharedDocSignedUrl - Fetch signed URL for a shared doc PDF
 * Used for thumbnail preview and PDF viewing. URL valid 15 min (R2 TTL).
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

interface UseSharedDocSignedUrlOptions {
  enabled?: boolean
}

export function useSharedDocSignedUrl(
  sectionId: string | null,
  options: UseSharedDocSignedUrlOptions = {}
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: ['shared-doc-signed-url', sectionId],
    queryFn: () => api.sharedDocs.getSignedUrl(sectionId!),
    enabled: enabled && !!sectionId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  })
}
