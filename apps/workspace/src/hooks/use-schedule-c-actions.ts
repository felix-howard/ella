/**
 * Schedule C Actions Hook - Mutations for send, lock, unlock, resend
 * Handles API calls and query invalidation
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api-client'
import { toast } from '../stores/toast-store'

interface UseScheduleCActionsOptions {
  caseId: string
  onSuccess?: () => void
}

export function useScheduleCActions({ caseId, onSuccess }: UseScheduleCActionsOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Invalidate Schedule C query after mutation
  const invalidateScheduleC = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-c', caseId] })
    onSuccess?.()
  }

  // Send expense form to client
  const sendForm = useMutation({
    mutationFn: () => api.scheduleC.send(caseId),
    onSuccess: (data) => {
      if (data.messageSent) {
        toast.success(t('scheduleC.formSent'))
      } else {
        toast.info(t('scheduleC.formCreatedNoSms'))
      }
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleC.formSendError'))
    },
  })

  // Lock form to prevent client edits
  const lock = useMutation({
    mutationFn: () => api.scheduleC.lock(caseId),
    onSuccess: () => {
      toast.success(t('scheduleC.formLocked'))
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleC.formLockError'))
    },
  })

  // Unlock form
  const unlock = useMutation({
    mutationFn: () => api.scheduleC.unlock(caseId),
    onSuccess: () => {
      toast.success(t('scheduleC.formUnlocked'))
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleC.formUnlockError'))
    },
  })

  // Resend form link
  const resend = useMutation({
    mutationFn: () => api.scheduleC.resend(caseId),
    onSuccess: (data) => {
      if (data.messageSent) {
        toast.success(t('scheduleC.linkResent'))
      } else {
        toast.info(t('scheduleC.linkExtendedNoSms'))
      }
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleC.linkResendError'))
    },
  })

  return {
    sendForm,
    lock,
    unlock,
    resend,
    // Combined loading state
    isLoading: sendForm.isPending || lock.isPending || unlock.isPending || resend.isPending,
  }
}
