import { useCallback } from 'react'
import type {
  Agreement,
  AgreementSource,
  AgreementType,
  CreateAgreementPayload,
  SaveAgreementDraftPayload,
  SendAgreementDraftPayload,
} from '../../lib/api-client'
import {
  buildCreateAgreementPayload,
  buildSaveAgreementDraftPayload,
  buildSendAgreementDraftPayload,
} from './agreement-draft-payload'
import { isAgreementDraftConflict } from './use-agreement-draft-mutations'
import type {
  Step3Resolved,
} from './wizard-steps/step3-content-editor'

interface UseAgreementDraftSubmitHandlersInput {
  type: AgreementType
  templateId: string | null
  effectiveTemplateId: string | null
  source: AgreementSource
  sourceSnapshot?: Record<string, unknown>
  savedAgreement: Agreement | null
  createMutation: {
    mutate: (payload: CreateAgreementPayload, options: { onSuccess: () => void }) => void
  }
  saveDraftMutation: {
    mutate: (
      payload: SaveAgreementDraftPayload,
      options: { onSuccess: (res: { data: Agreement }) => void },
    ) => void
  }
  sendDraftMutation: {
    mutate: (
      input: { agreementId: string; payload: SendAgreementDraftPayload },
      options: { onSuccess: () => void; onError: (error: unknown) => void },
    ) => void
  }
  resetSavedBaseline: (payload: SaveAgreementDraftPayload) => void
  setSavedDraft: (agreement: Agreement, resolved: Step3Resolved) => void
  setConflictMessage: (message: string | null) => void
  onClose: () => void
  conflictMessage: string
}

export function useAgreementDraftSubmitHandlers({
  type,
  templateId,
  effectiveTemplateId,
  source,
  sourceSnapshot,
  savedAgreement,
  createMutation,
  saveDraftMutation,
  sendDraftMutation,
  resetSavedBaseline,
  setSavedDraft,
  setConflictMessage,
  onClose,
  conflictMessage,
}: UseAgreementDraftSubmitHandlersInput): {
  handleSaveDraft: (resolved: Step3Resolved) => void
  handleSubmit: (resolved: Step3Resolved) => void
} {
  const handleSaveDraft = useCallback((resolved: Step3Resolved) => {
    const payload = buildSaveAgreementDraftPayload({ type, templateId, resolved, source, sourceSnapshot })
    saveDraftMutation.mutate(payload, {
      onSuccess: (res) => {
        setSavedDraft(res.data, resolved)
        resetSavedBaseline(payload)
      },
    })
  }, [resetSavedBaseline, saveDraftMutation, setSavedDraft, source, sourceSnapshot, templateId, type])

  const handleSubmit = useCallback((resolved: Step3Resolved) => {
    if (!savedAgreement) {
      createMutation.mutate(buildCreateAgreementPayload({ type, templateId, resolved }), { onSuccess: onClose })
      return
    }

    const payload = buildSendAgreementDraftPayload({
      type,
      templateId: effectiveTemplateId,
      resolved,
      expectedUpdatedAt: savedAgreement.updatedAt,
    })
    sendDraftMutation.mutate(
      { agreementId: savedAgreement.id, payload },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (isAgreementDraftConflict(error)) {
            setConflictMessage((error as Error).message || conflictMessage)
          }
        },
      },
    )
  }, [
    conflictMessage,
    createMutation,
    effectiveTemplateId,
    onClose,
    savedAgreement,
    sendDraftMutation,
    setConflictMessage,
    templateId,
    type,
  ])

  return { handleSaveDraft, handleSubmit }
}
