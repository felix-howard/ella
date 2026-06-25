import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ApiError,
  type AgreementType,
  type DiscardAgreementDraftPayload,
  type SaveAgreementDraftPayload,
  type SendAgreementDraftPayload,
  type UpdateAgreementDraftPayload,
} from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { EntityRef } from './types'
import {
  agreementsApi,
  useInvalidateAgreements,
} from './use-agreement-mutations'

function agreementTypeLabel(t: (key: string) => string, type: AgreementType): string {
  return t(`agreements.type.${type}`)
}

export function isAgreementDraftConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}

export function useSaveAgreementDraft(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)

  return useMutation({
    mutationFn: (payload: SaveAgreementDraftPayload) =>
      agreementsApi(entity).saveDraft(entity.id, payload),
    onSuccess: (_data, payload) => {
      const typeLabel = agreementTypeLabel(t, payload.type ?? 'NDA')
      toast.success(t('agreements.draft.toast.saved', { type: typeLabel }))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(err.message || t('agreements.draft.toast.saveFailed'))
    },
  })
}

export function useUpdateAgreementDraft(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)

  return useMutation({
    mutationFn: ({
      agreementId,
      payload,
    }: {
      agreementId: string
      payload: UpdateAgreementDraftPayload
    }) => agreementsApi(entity).updateDraft(entity.id, agreementId, payload),
    onSuccess: () => {
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(
        isAgreementDraftConflict(err)
          ? t('agreements.draft.conflict.message')
          : err.message || t('agreements.draft.toast.saveFailed'),
      )
    },
  })
}

export function useSendAgreementDraft(entity: EntityRef, fallbackType: AgreementType) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)

  return useMutation({
    mutationFn: ({
      agreementId,
      payload,
    }: {
      agreementId: string
      payload: SendAgreementDraftPayload
    }) => agreementsApi(entity).sendDraft(entity.id, agreementId, payload),
    onSuccess: (res) => {
      const typeLabel = agreementTypeLabel(t, res.data.type ?? fallbackType)
      toast.success(t('agreements.toast.sent', { type: typeLabel }))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(
        isAgreementDraftConflict(err)
          ? t('agreements.draft.conflict.message')
          : err.message || t('nda.toast.sendFailed'),
      )
    },
  })
}

export function useDiscardAgreementDraft(entity: EntityRef) {
  const { t } = useTranslation()
  const invalidate = useInvalidateAgreements(entity)

  return useMutation({
    mutationFn: ({
      agreementId,
      payload,
    }: {
      agreementId: string
      payload: DiscardAgreementDraftPayload
    }) => agreementsApi(entity).discardDraft(entity.id, agreementId, payload),
    onSuccess: () => {
      toast.success(t('agreements.draft.toast.discarded'))
      invalidate()
    },
    onError: (err: Error) => {
      toast.error(
        isAgreementDraftConflict(err)
          ? t('agreements.draft.conflict.message')
          : err.message || t('agreements.draft.toast.discardFailed'),
      )
    },
  })
}
