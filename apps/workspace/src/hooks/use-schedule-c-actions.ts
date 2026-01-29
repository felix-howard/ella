/**
 * Schedule C Actions Hook - Mutations for send, lock, unlock, resend
 * Handles API calls and query invalidation
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { toast } from '../stores/toast-store'

interface UseScheduleCActionsOptions {
  caseId: string
  onSuccess?: () => void
}

export function useScheduleCActions({ caseId, onSuccess }: UseScheduleCActionsOptions) {
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
        toast.success('Đã gửi form thu thập chi phí')
      } else {
        toast.info('Đã tạo form nhưng không gửi được SMS')
      }
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi gửi form')
    },
  })

  // Lock form to prevent client edits
  const lock = useMutation({
    mutationFn: () => api.scheduleC.lock(caseId),
    onSuccess: () => {
      toast.success('Đã khóa form Schedule C')
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi khóa form')
    },
  })

  // Unlock form
  const unlock = useMutation({
    mutationFn: () => api.scheduleC.unlock(caseId),
    onSuccess: () => {
      toast.success('Đã mở khóa form Schedule C')
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi mở khóa')
    },
  })

  // Resend form link
  const resend = useMutation({
    mutationFn: () => api.scheduleC.resend(caseId),
    onSuccess: (data) => {
      if (data.messageSent) {
        toast.success('Đã gửi lại link form')
      } else {
        toast.info('Đã gia hạn link nhưng không gửi được SMS')
      }
      invalidateScheduleC()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi gửi lại')
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
