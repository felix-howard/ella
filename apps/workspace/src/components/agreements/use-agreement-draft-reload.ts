import { useCallback, useState } from 'react'
import type { Agreement, SaveAgreementDraftPayload } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import {
  buildSaveAgreementDraftPayload,
  createStep3DraftFromAgreement,
  createStep3ResolvedFromAgreement,
} from './agreement-draft-payload'
import { agreementsApi } from './use-agreement-mutations'
import type { EntityRef } from './types'
import type {
  Step3Draft,
  Step3Resolved,
} from './wizard-steps/step3-content-editor'

interface UseAgreementDraftReloadInput {
  entity: EntityRef
  savedAgreement: Agreement | null
  resetSavedBaseline: (payload: SaveAgreementDraftPayload | null) => void
  setDraft: (draft: Step3Draft) => void
  setSavedDraft: (agreement: Agreement, resolved: Step3Resolved) => void
  setConflictMessage: (message: string | null) => void
  t: (key: string) => string
}

interface UseAgreementDraftReloadResult {
  isReloading: boolean
  reloadDraft: () => Promise<void>
}

export function useAgreementDraftReload({
  entity,
  savedAgreement,
  resetSavedBaseline,
  setDraft,
  setSavedDraft,
  setConflictMessage,
  t,
}: UseAgreementDraftReloadInput): UseAgreementDraftReloadResult {
  const [isReloading, setIsReloading] = useState(false)

  const reloadDraft = useCallback(async () => {
    if (!savedAgreement) return
    try {
      setIsReloading(true)
      const res = await agreementsApi(entity).list(entity.id)
      const remote = res.data.find((agreement) => agreement.id === savedAgreement.id)
      if (!remote || remote.status !== 'DRAFT') {
        toast.error(t('agreements.draft.toast.reloadFailed'))
        return
      }

      const nextDraft = createStep3DraftFromAgreement(remote)
      const nextResolved = createStep3ResolvedFromAgreement(remote)
      const nextPayload = buildSaveAgreementDraftPayload({
        type: remote.type,
        templateId: remote.templateId,
        resolved: nextResolved,
        source: remote.source,
        sourceSnapshot: remote.sourceSnapshot ?? undefined,
      })
      setDraft(nextDraft)
      setSavedDraft(remote, nextResolved)
      setConflictMessage(null)
      resetSavedBaseline(nextPayload)
      toast.success(t('agreements.draft.toast.reloaded'))
    } catch (err) {
      toast.error((err as Error).message || t('agreements.draft.toast.reloadFailed'))
    } finally {
      setIsReloading(false)
    }
  }, [
    entity,
    resetSavedBaseline,
    savedAgreement,
    setConflictMessage,
    setDraft,
    setSavedDraft,
    t,
  ])

  return { isReloading, reloadDraft }
}
