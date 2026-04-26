/**
 * TanStack Query hooks for NDA operations on a Lead.
 * List query + 3 mutations (create, resend, updateDeposit).
 * Each mutation invalidates the list + lead caches and surfaces a toast.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import type { NdaDepositStatus } from '../../../lib/api-client'

export const ndaListKey = (leadId: string) => ['lead', leadId, 'nda', 'list'] as const

export function useNdaList(leadId: string, enabled = true) {
  return useQuery({
    queryKey: ndaListKey(leadId),
    queryFn: () => api.leads.nda.list(leadId),
    enabled: enabled && !!leadId,
    staleTime: 15_000,
  })
}

function useInvalidateNda(leadId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ndaListKey(leadId) })
    qc.invalidateQueries({ queryKey: ['lead', leadId] })
    // Lead NDA mutations transfer to Client after conversion — keep the
    // Client Overview NDA section in sync. Broad match across all clients
    // since we don't track the converted clientId here.
    qc.invalidateQueries({ queryKey: ['client-nda'] })
  }
}

export interface CreateNdaPayload {
  contentHtml?: string
}

export function useCreateNda(leadId: string) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(leadId)
  return useMutation({
    mutationFn: (payload: CreateNdaPayload = {}) =>
      api.leads.nda.create(leadId, payload),
    onSuccess: () => {
      toast.success(t('nda.toast.sent'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.sendFailed'))
    },
  })
}

export function useNdaPreview(leadId: string) {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (payload: { contentHtml?: string }) =>
      api.leads.nda.previewPdf(leadId, payload),
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.previewFailed'))
    },
  })
}

export function useResendNda(leadId: string) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(leadId)
  return useMutation({
    mutationFn: (ndaId: string) => api.leads.nda.resend(leadId, ndaId),
    onSuccess: (res) => {
      toast.success(res.rotated ? t('nda.toast.resentRotated') : t('nda.toast.resent'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.resendFailed'))
    },
  })
}

export interface UpdateDepositPayload {
  ndaId: string
  depositStatus: NdaDepositStatus
  depositNote?: string | null
  depositPaidAt?: string | null
}

export function useUpdateDeposit(leadId: string) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(leadId)
  return useMutation({
    mutationFn: ({ ndaId, depositStatus, depositNote, depositPaidAt }: UpdateDepositPayload) =>
      api.leads.nda.updateDeposit(leadId, ndaId, { depositStatus, depositNote, depositPaidAt }),
    onSuccess: () => {
      toast.success(t('nda.toast.depositUpdated'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.depositUpdateFailed'))
    },
  })
}
