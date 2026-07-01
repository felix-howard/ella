import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { agreementsApi, useInvalidateAgreements } from './use-agreement-mutations'
import { toast } from '../../stores/toast-store'
import type { AgreementPaymentPortalSendResult } from '../../lib/api-client'
import type { EntityRef } from './types'

export function useSendAgreementPaymentPortal(entity: EntityRef) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const invalidateAgreements = useInvalidateAgreements(entity)

  return useMutation<AgreementPaymentPortalSendResult, Error, string>({
    mutationFn: (agreementId) =>
      agreementsApi(entity).sendPaymentPortal(entity.id, agreementId),
    onSuccess: (result) => {
      if (result.smsSent) {
        toast.success(t('agreements.paymentPortal.sent'))
      } else if (result.smsSkippedReason === 'already_sent') {
        toast.info(t('agreements.paymentPortal.alreadySent'))
      } else {
        toast.info(t('agreements.paymentPortal.smsSkipped'))
      }

      invalidateAgreements()
      if (entity.type === 'client') {
        queryClient.invalidateQueries({ queryKey: ['client-payments', entity.id] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['client-payments'] })
      }
    },
    onError: (error) => {
      toast.error(error.message || t('agreements.paymentPortal.sendFailed'))
    },
  })
}
