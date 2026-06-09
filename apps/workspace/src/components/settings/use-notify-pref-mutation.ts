/**
 * Shared optimistic auto-save mutation for a single boolean notification
 * preference on the current user's staff profile (Settings → Notifications).
 * Optimistically patches the ['team-member-profile','me'] cache, rolls back
 * on error, and refreshes profile queries on settle.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, type ProfileResponse, type UpdateStaffProfileInput } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export type NotifyPrefField =
  | 'notifyOnUpload'
  | 'notifyOnChat'
  | 'notifyOnAgreementSigned'
  | 'notifyOnClientPayment'

const PROFILE_QUERY_KEY = ['team-member-profile', 'me']

export function useNotifyPrefMutation(
  staff: ProfileResponse['staff'] | undefined,
  field: NotifyPrefField,
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (value: boolean) => {
      const payload: UpdateStaffProfileInput = {
        firstName: staff!.firstName,
        lastName: staff!.lastName,
        phoneNumber: staff!.phoneNumber || null,
        [field]: value,
      }
      return api.team.updateProfile('me', payload)
    },
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: PROFILE_QUERY_KEY })
      const previous = queryClient.getQueryData(PROFILE_QUERY_KEY)
      queryClient.setQueryData(PROFILE_QUERY_KEY, (old: Record<string, unknown>) =>
        old
          ? { ...old, staff: { ...(old.staff as Record<string, unknown>), [field]: value } }
          : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(PROFILE_QUERY_KEY, context.previous)
      toast.error(t('profile.updateError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
    },
  })
}
