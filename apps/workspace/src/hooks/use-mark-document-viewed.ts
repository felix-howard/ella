/**
 * useMarkDocumentViewed - Hook for marking documents as viewed
 * Fires API call to create DocumentView record for per-CPA tracking
 * Invalidates clients query to update upload counts in client list
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'

export function useMarkDocumentViewed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rawImageId: string) => api.images.markViewed(rawImageId),
    onSuccess: () => {
      // Invalidate clients query to update upload counts in client list
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
