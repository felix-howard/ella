/**
 * Entity-agnostic TanStack Query hooks for Agreement operations.
 * List query + 4 mutations (create, preview, resend, updateDeposit) parameterized
 * by `EntityRef`. Cache keys include entity type so leads and clients don't
 * cross-invalidate. Each mutation surfaces a toast and refreshes related caches.
 *
 * Cache key prefix kept as 'nda' so existing places (Client Overview list query,
 * Lead activity timeline) that share the same query key continue to invalidate
 * uniformly during the rename.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type {
  AgreementType,
  CreateAgreementPayload,
  NdaDepositStatus,
} from '../../lib/api-client'
import type { EntityRef } from './types'

/** Look up the user-facing label for an agreement type. */
function agreementTypeLabel(t: (k: string) => string, type: AgreementType): string {
  return t(`agreements.type.${type}`)
}

export const agreementListKey = (entity: EntityRef, type?: AgreementType) =>
  ['nda', entity.type, entity.id, 'list', type ?? 'all'] as const

export function agreementsApi(entity: EntityRef) {
  return entity.type === 'lead' ? api.leads.agreements : api.clients.agreements
}

export function useAgreementsList(
  entity: EntityRef,
  enabled = true,
  type?: AgreementType,
) {
  return useQuery({
    queryKey: agreementListKey(entity, type),
    queryFn: () => agreementsApi(entity).list(entity.id, type ? { type } : undefined),
    enabled: enabled && !!entity.id,
    staleTime: 15_000,
  })
}

function useInvalidateAgreements(entity: EntityRef) {
  const qc = useQueryClient()
  return () => {
    // Invalidate every type-filter variant for this entity (list key has type suffix).
    qc.invalidateQueries({ queryKey: ['nda', entity.type, entity.id, 'list'] })
    qc.invalidateQueries({ queryKey: [entity.type, entity.id] })
    if (entity.type === 'lead') {
      // Agreement invite SMS dual-writes into Message — refresh chat panel so
      // outbound message shows up immediately (not relying solely on realtime).
      qc.invalidateQueries({ queryKey: ['messages', 'lead', entity.id] })
      // Lead agreement mutations may transfer to Client after conversion — broad
      // match across all client agreement caches since converted clientId isn't
      // tracked at this layer.
      qc.invalidateQueries({ queryKey: ['nda', 'client'] })
    } else {
      // caseId isn't known here so widen to all messages.
      qc.invalidateQueries({ queryKey: ['messages'] })
    }
  }
}

export function useCreateAgreement(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)
  return useMutation({
    mutationFn: (payload: CreateAgreementPayload) =>
      agreementsApi(entity).create(entity.id, payload),
    onSuccess: (_data, payload) => {
      const typeLabel = agreementTypeLabel(t, payload.type ?? 'NDA')
      toast.success(t('agreements.toast.sent', { type: typeLabel }))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.sendFailed'))
    },
  })
}

export function useAgreementPreview(entity: EntityRef) {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (payload: { contentHtml?: string; title?: string }) =>
      agreementsApi(entity).previewPdf(entity.id, payload),
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.previewFailed'))
    },
  })
}

export function useResendAgreement(entity: EntityRef, fallbackType?: AgreementType) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)
  return useMutation({
    mutationFn: (agreementId: string) => agreementsApi(entity).resend(entity.id, agreementId),
    onSuccess: (res) => {
      const typeLabel = agreementTypeLabel(t, res.data.type ?? fallbackType ?? 'NDA')
      toast.success(
        res.rotated
          ? t('agreements.toast.resentRotated', { type: typeLabel })
          : t('agreements.toast.resent', { type: typeLabel }),
      )
      invalidate()
    },
    onError: (err: Error) => {
      const typeLabel = agreementTypeLabel(t, fallbackType ?? 'NDA')
      toast.error(err.message || t('agreements.toast.resendFailed', { type: typeLabel }))
    },
  })
}

export interface UpdateDepositPayload {
  agreementId: string
  depositStatus: NdaDepositStatus
  depositNote?: string | null
  depositPaidAt?: string | null
}

export function useUpdateDeposit(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)
  return useMutation({
    mutationFn: ({ agreementId, depositStatus, depositNote, depositPaidAt }: UpdateDepositPayload) =>
      agreementsApi(entity).updateDeposit(entity.id, agreementId, {
        depositStatus,
        depositNote,
        depositPaidAt,
      }),
    onSuccess: () => {
      toast.success(t('nda.toast.depositUpdated'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('nda.toast.depositUpdateFailed'))
    },
  })
}
