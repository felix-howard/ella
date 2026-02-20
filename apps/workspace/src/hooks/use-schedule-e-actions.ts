/**
 * Schedule E Actions Hook - Mutations for send, lock, unlock, resend
 * Handles API calls, optimistic updates, and query invalidation for rental property forms
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, type ScheduleEResponse } from '../lib/api-client'
import { toast } from '../stores/toast-store'

interface UseScheduleEActionsOptions {
  caseId: string
  onSuccess?: () => void
}

export function useScheduleEActions({ caseId, onSuccess }: UseScheduleEActionsOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const queryKey = ['schedule-e', caseId]

  // Invalidate Schedule E query after mutation
  const invalidateScheduleE = () => {
    queryClient.invalidateQueries({ queryKey })
    onSuccess?.()
  }

  // Send rental form to client with optional custom message
  const sendForm = useMutation({
    mutationFn: (customMessage?: string) => api.scheduleE.send(caseId, customMessage),
    onSuccess: (data) => {
      if (data.messageSent) {
        toast.success(t('scheduleE.formSent'))
      } else {
        toast.info(t('scheduleE.formCreatedNoSms'))
      }
      invalidateScheduleE()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleE.formSendError'))
    },
  })

  // Lock form to prevent client edits - with optimistic update
  const lock = useMutation({
    mutationFn: () => api.scheduleE.lock(caseId),
    // Optimistic update: immediately set status to LOCKED
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<ScheduleEResponse>(queryKey)

      if (previousData?.expense) {
        queryClient.setQueryData<ScheduleEResponse>(queryKey, {
          ...previousData,
          expense: {
            ...previousData.expense,
            status: 'LOCKED',
            lockedAt: new Date().toISOString(),
          },
        })
      }
      return { previousData }
    },
    onSuccess: () => {
      toast.success(t('scheduleE.formLocked'))
      invalidateScheduleE()
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
      toast.error(error.message || t('scheduleE.formLockError'))
    },
  })

  // Unlock form - with optimistic update
  const unlock = useMutation({
    mutationFn: () => api.scheduleE.unlock(caseId),
    // Optimistic update: immediately set status to SUBMITTED
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<ScheduleEResponse>(queryKey)

      if (previousData?.expense) {
        queryClient.setQueryData<ScheduleEResponse>(queryKey, {
          ...previousData,
          expense: {
            ...previousData.expense,
            status: 'SUBMITTED',
            lockedAt: null,
          },
        })
      }
      return { previousData }
    },
    onSuccess: () => {
      toast.success(t('scheduleE.formUnlocked'))
      invalidateScheduleE()
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
      toast.error(error.message || t('scheduleE.formUnlockError'))
    },
  })

  // Resend form link
  const resend = useMutation({
    mutationFn: () => api.scheduleE.resend(caseId),
    onSuccess: (data) => {
      if (data.messageSent) {
        toast.success(t('scheduleE.linkResent'))
      } else {
        toast.info(t('scheduleE.linkExtendedNoSms'))
      }
      invalidateScheduleE()
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scheduleE.linkResendError'))
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
