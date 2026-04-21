/**
 * useSharedDocs - Fetch list + mutations for multi-section shared docs per case
 * Supports create, rename, delete. Invalidates list cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'

interface UseSharedDocsOptions {
  caseId: string | undefined
  enabled?: boolean
}

export function useSharedDocs({ caseId, enabled = true }: UseSharedDocsOptions) {
  const queryClient = useQueryClient()
  const queryKey = ['shared-docs', caseId] as const

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.sharedDocs.list(caseId!),
    enabled: !!caseId && enabled,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: ({ title, file }: { title: string; file: File }) =>
      api.sharedDocs.create(caseId!, title, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.sharedDocs.rename(id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.sharedDocs.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const uploadVersionMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.sharedDocs.uploadVersion(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const extendMutation = useMutation({
    mutationFn: (id: string) => api.sharedDocs.extend(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.sharedDocs.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    documents: data?.documents ?? [],
    isLoading,
    error,
    refetch,
    createSection: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    renameSection: renameMutation.mutateAsync,
    isRenaming: renameMutation.isPending,
    deleteSection: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    uploadVersion: uploadVersionMutation.mutateAsync,
    isUploadingVersion: uploadVersionMutation.isPending,
    extendLink: extendMutation.mutateAsync,
    isExtending: extendMutation.isPending,
    revokeLink: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  }
}
