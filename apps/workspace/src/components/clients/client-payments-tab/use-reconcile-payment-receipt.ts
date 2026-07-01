import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, type ClientPayment } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'

interface ClientPaymentsResponse {
  success: boolean
  data: ClientPayment[]
  pastDue?: boolean
}

export function useReconcilePaymentReceipt(clientId: string) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paymentId: string) => api.clients.payments.reconcileReceipt(clientId, paymentId),
    onSuccess: (response, paymentId) => {
      queryClient.setQueryData<ClientPaymentsResponse>(
        ['client-payments', clientId],
        (current) => {
          if (!current) return current
          return {
            ...current,
            data: current.data.map((payment) =>
              payment.id === paymentId ? response.data : payment
            ),
          }
        }
      )
      void queryClient.invalidateQueries({ queryKey: ['client-payments', clientId] })

      if (response.data.receiptStatus === 'available') {
        toast.success(t('payments.receiptRefreshSuccess'))
        return
      }
      toast.info(t('payments.receiptStillPending'))
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('payments.receiptRefreshError')
      toast.error(message)
    },
  })
}
