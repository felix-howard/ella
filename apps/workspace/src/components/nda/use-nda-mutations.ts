/**
 * Entity-agnostic TanStack Query hooks for NDA operations.
 * List query + 4 mutations (create, preview, resend, updateDeposit) parameterized
 * by `EntityRef`. Cache keys include entity type so leads and clients don't
 * cross-invalidate. Each mutation surfaces a toast and refreshes related caches.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { NdaDepositStatus } from '../../lib/api-client'
import type { EntityRef } from './types'

export const ndaListKey = (entity: EntityRef) =>
  ['nda', entity.type, entity.id, 'list'] as const

export function ndaApi(entity: EntityRef) {
  return entity.type === 'lead' ? api.leads.nda : api.clients.nda
}

export function useNdaList(entity: EntityRef, enabled = true) {
  return useQuery({
    queryKey: ndaListKey(entity),
    queryFn: () => ndaApi(entity).list(entity.id),
    enabled: enabled && !!entity.id,
    staleTime: 15_000,
  })
}

function useInvalidateNda(entity: EntityRef) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ndaListKey(entity) })
    qc.invalidateQueries({ queryKey: [entity.type, entity.id] })
    if (entity.type === 'lead') {
      // NDA invite SMS dual-writes into Message — refresh chat panel so the
      // outbound message shows up immediately (not relying solely on realtime).
      qc.invalidateQueries({ queryKey: ['messages', 'lead', entity.id] })
      // Lead NDA mutations may transfer to Client after conversion — broad
      // match across all client NDA caches since converted clientId isn't
      // tracked at this layer.
      qc.invalidateQueries({ queryKey: ['nda', 'client'] })
    } else {
      // caseId isn't known here so widen to all messages.
      qc.invalidateQueries({ queryKey: ['messages'] })
    }
  }
}

export interface CreateNdaPayload {
  contentHtml?: string
}

export function useCreateNda(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(entity)
  return useMutation({
    mutationFn: (payload: CreateNdaPayload = {}) =>
      ndaApi(entity).create(entity.id, payload),
    onSuccess: () => {
      toast.success(t('nda.toast.sent'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.sendFailed'))
    },
  })
}

export function useNdaPreview(entity: EntityRef) {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (payload: { contentHtml?: string }) =>
      ndaApi(entity).previewPdf(entity.id, payload),
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.previewFailed'))
    },
  })
}

export function useResendNda(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(entity)
  return useMutation({
    mutationFn: (ndaId: string) => ndaApi(entity).resend(entity.id, ndaId),
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

export function useUpdateDeposit(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateNda(entity)
  return useMutation({
    mutationFn: ({ ndaId, depositStatus, depositNote, depositPaidAt }: UpdateDepositPayload) =>
      ndaApi(entity).updateDeposit(entity.id, ndaId, { depositStatus, depositNote, depositPaidAt }),
    onSuccess: () => {
      toast.success(t('nda.toast.depositUpdated'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.depositUpdateFailed'))
    },
  })
}
