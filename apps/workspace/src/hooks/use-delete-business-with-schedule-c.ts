/**
 * Mutation hook for deleting a BUSINESS client that owns a Schedule C.
 * Wraps the existing api.clients.delete call but adds the cache invalidations
 * and navigation appropriate for the cascade-delete flow (Phase 8).
 *
 * The backend handles the audit + cascade transaction; this hook only owns
 * client-side cache invalidation and post-delete navigation back to the
 * parent individual (so the CPA lands somewhere meaningful, not /clients).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api-client'
import { toast } from '../stores/toast-store'

interface UseDeleteBusinessWithScheduleCOptions {
  businessId: string
  /** Group ID to invalidate after delete (so sibling individual refetches). */
  groupId?: string | null
  /** Parent individual to navigate to. Falls back to /clients if absent. */
  parentIndividualId?: string | null
  /** Optional callback fired after success (e.g. close modal, etc.). */
  onSuccess?: () => void
}

export function useDeleteBusinessWithScheduleC(opts: UseDeleteBusinessWithScheduleCOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => api.clients.delete(opts.businessId),
    onSuccess: () => {
      toast.success(t('clients.deleteBusinessWithSC.successToast'))

      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (opts.groupId) {
        queryClient.invalidateQueries({ queryKey: ['client-group', opts.groupId] })
      }
      if (opts.parentIndividualId) {
        queryClient.invalidateQueries({ queryKey: ['client', opts.parentIndividualId] })
      }

      opts.onSuccess?.()

      if (opts.parentIndividualId) {
        navigate({ to: '/clients/$clientId', params: { clientId: opts.parentIndividualId } })
      } else {
        navigate({ to: '/clients' })
      }
    },
    onError: () => {
      toast.error(t('clients.deleteBusinessWithSC.errorToast'))
    },
  })
}
