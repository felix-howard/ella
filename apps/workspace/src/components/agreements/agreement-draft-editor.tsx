import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  Agreement,
  AgreementPaymentPortalSendMode,
  AgreementSource,
  AgreementType,
  CalculatorAgreementQuotePayload,
} from '../../lib/api-client'
import { createStep3DraftFromAgreement } from './agreement-draft-payload'
import { useAgreementDraftAutosave } from './use-agreement-draft-autosave'
import { useAgreementDraftCloseGuard } from './use-agreement-draft-close-guard'
import { useAgreementDraftMetadata } from './use-agreement-draft-metadata'
import { useAgreementDraftPayloadState } from './use-agreement-draft-payload-state'
import { useAgreementDraftReload } from './use-agreement-draft-reload'
import {
  useAgreementDraftSavedState,
  type AgreementDraftSavedState,
} from './use-agreement-draft-saved-state'
import { useAgreementDraftSubmitHandlers } from './use-agreement-draft-submit-handlers'
import { useCreateAgreement } from './use-agreement-mutations'
import { useSaveAgreementDraft, useSendAgreementDraft } from './use-agreement-draft-mutations'
import { Step3ContentEditor, emptyStep3Draft, type Step3Draft } from './wizard-steps/step3-content-editor'
import type { EntityRef } from './types'

interface AgreementDraftEditorProps {
  entity: EntityRef
  type: AgreementType
  templateId: string | null
  source: AgreementSource
  sourceSnapshot?: Record<string, unknown>
  calculatorQuote?: CalculatorAgreementQuotePayload
  paymentPortalMode?: AgreementPaymentPortalSendMode
  draft?: Step3Draft
  onDraftChange?: (draft: Step3Draft) => void
  initialDraft?: Step3Draft
  closeBaselineDraft?: Step3Draft
  existingDraft?: Agreement
  savedState?: AgreementDraftSavedState | null
  onSavedStateChange?: (state: AgreementDraftSavedState | null) => void
  onClose: () => void
  registerCloseGuard?: (guard: (() => boolean) | null) => void
}

export function AgreementDraftEditor({
  entity,
  type,
  templateId,
  source,
  sourceSnapshot,
  calculatorQuote,
  paymentPortalMode,
  draft: controlledDraft,
  onDraftChange,
  initialDraft,
  closeBaselineDraft,
  existingDraft,
  savedState,
  onSavedStateChange,
  onClose,
  registerCloseGuard,
}: AgreementDraftEditorProps) {
  const { t, i18n } = useTranslation()
  const createMutation = useCreateAgreement(entity)
  const saveDraftMutation = useSaveAgreementDraft(entity)
  const sendDraftMutation = useSendAgreementDraft(entity, type)

  const [localDraft, setLocalDraft] = useState<Step3Draft>(() => existingDraft
    ? createStep3DraftFromAgreement(existingDraft)
    : (initialDraft ?? emptyStep3Draft))
  const draft = controlledDraft ?? localDraft
  const setDraftState = useCallback((nextDraft: Step3Draft) => {
    setLocalDraft(nextDraft)
    onDraftChange?.(nextDraft)
  }, [onDraftChange])
  const { savedAgreement, savedResolved, setSavedDraft } = useAgreementDraftSavedState({
    existingDraft,
    savedState,
    onSavedStateChange,
  })
  const fallbackTitle = t(`agreements.type.${type}`)
  const { effectiveTemplateId, autosaveResolved, autosavePayload } = useAgreementDraftPayloadState({
    draft,
    savedAgreement,
    savedResolved,
    fallbackTitle,
    type,
    templateId,
    source,
    sourceSnapshot,
    calculatorQuote,
  })

  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const autosave = useAgreementDraftAutosave({
    entity,
    draftAgreementId: savedAgreement?.id ?? null,
    payload: autosavePayload,
    updatedAt: savedAgreement?.updatedAt ?? null,
    enabled: Boolean(savedAgreement && autosavePayload),
    paused: sendDraftMutation.isPending,
    onSaved: useCallback((agreement) => {
      if (autosaveResolved) setSavedDraft(agreement, autosaveResolved)
    }, [autosaveResolved, setSavedDraft]),
    onConflict: useCallback((error) => {
      setConflictMessage(error.message || t('agreements.draft.conflict.message'))
    }, [t]),
  })

  const { isReloading, reloadDraft } = useAgreementDraftReload({
    entity,
    savedAgreement,
    resetSavedBaseline: autosave.resetSavedBaseline,
    setDraft: setDraftState,
    setSavedDraft,
    setConflictMessage,
    t,
  })

  const isBusy = createMutation.isPending || saveDraftMutation.isPending ||
    sendDraftMutation.isPending || isReloading

  const draftMetadata = useAgreementDraftMetadata({
    savedAgreement,
    language: i18n.language,
    t,
  })

  const handleClose = useAgreementDraftCloseGuard({
    draft,
    baselineDraft: closeBaselineDraft ?? initialDraft,
    isBusy,
    savedAgreement,
    autosaveState: autosave.state,
    onClose,
    registerCloseGuard,
    busyConfirmMessage: t('agreements.draft.closeBusyConfirm'),
    unsavedConfirmMessage: t('agreements.draft.closeUnsavedConfirm'),
  })

  const { handleSaveDraft, handleSubmit } = useAgreementDraftSubmitHandlers({
    type,
    templateId,
    effectiveTemplateId,
    source,
    sourceSnapshot,
    calculatorQuote,
    paymentPortalMode,
    savedAgreement,
    createMutation,
    saveDraftMutation,
    sendDraftMutation,
    resetSavedBaseline: autosave.resetSavedBaseline,
    setSavedDraft,
    setConflictMessage,
    onClose,
    conflictMessage: t('agreements.draft.conflict.message'),
  })

  const sendBlockedReason = useMemo(() => {
    if (conflictMessage || autosave.state === 'conflict') {
      return t('agreements.draft.conflict.sendBlocked')
    }
    if (autosave.state === 'saving') {
      return t('agreements.draft.savingSendBlocked')
    }
    return null
  }, [autosave.state, conflictMessage, t])

  const draftSaveState = saveDraftMutation.isPending ? 'saving' : autosave.state

  return (
    <Step3ContentEditor
      entity={entity}
      type={type}
      templateId={templateId}
      isSubmitting={isBusy}
      draft={draft}
      onDraftChange={setDraftState}
      onCancel={handleClose}
      onSubmit={handleSubmit}
      onSaveDraft={handleSaveDraft}
      draftSaveState={draftSaveState}
      draftMetadata={draftMetadata}
      isDraftSaved={Boolean(savedAgreement)}
      conflictMessage={conflictMessage}
      sendBlockedReason={sendBlockedReason}
      onReloadDraft={savedAgreement ? reloadDraft : undefined}
    />
  )
}
