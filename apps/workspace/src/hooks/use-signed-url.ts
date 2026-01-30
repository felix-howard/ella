/**
 * useSignedUrl - Hook to fetch and cache signed URLs for images
 * Automatically refreshes when URL expires
 * Supports invalidation when R2 file is renamed during classification
 */

import { useCallback } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'

interface UseSignedUrlOptions {
  /** Enable/disable the query */
  enabled?: boolean
  /** Stale time in ms (default: 50 minutes, since URLs expire in 1 hour) */
  staleTime?: number
}

/**
 * Hook to fetch a signed URL for an image
 * Caches the URL and automatically refreshes before expiry
 */
export function useSignedUrl(imageId: string | null, options: UseSignedUrlOptions = {}) {
  const { enabled = true, staleTime = 50 * 60 * 1000 } = options // 50 minutes default
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['signedUrl', imageId],
    queryFn: async () => {
      if (!imageId) throw new Error('No image ID provided')
      return api.cases.getImageSignedUrl(imageId)
    },
    enabled: enabled && !!imageId,
    staleTime, // URL valid for ~1 hour, refresh at 50 min
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 3, // Increased for better resilience with R2 signed URLs
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff for new uploads
    refetchOnWindowFocus: false,
  })

  /**
   * Invalidate cached signed URL and refetch.
   * Called when an image/PDF fails to load (e.g., R2 file renamed during classification).
   * The refetch will read the updated r2Key from DB and generate a new valid signed URL.
   */
  const invalidateAndRefetch = useCallback(() => {
    if (!imageId) return
    queryClient.invalidateQueries({ queryKey: ['signedUrl', imageId] })
  }, [imageId, queryClient])

  return { ...query, invalidateAndRefetch }
}

/**
 * Prefetch multiple signed URLs in parallel
 * Useful for prefetching gallery images
 */
export async function prefetchSignedUrls(
  imageIds: string[],
  queryClient: QueryClient
) {
  await Promise.all(
    imageIds.map((id) =>
      queryClient.prefetchQuery({
        queryKey: ['signedUrl', id],
        queryFn: () => api.cases.getImageSignedUrl(id),
        staleTime: 50 * 60 * 1000,
      })
    )
  )
}
