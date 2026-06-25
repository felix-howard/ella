import { useCallback, useEffect, useRef } from 'react'
import type { Agreement } from '../../lib/api-client'
import type { AgreementDraftAutosaveState } from './use-agreement-draft-autosave'
import type { Step3Draft } from './wizard-steps/step3-content-editor'

interface UseAgreementDraftCloseGuardInput {
  draft: Step3Draft
  baselineDraft?: Step3Draft
  isBusy: boolean
  savedAgreement: Agreement | null
  autosaveState: AgreementDraftAutosaveState
  onClose: () => void
  registerCloseGuard?: (guard: (() => boolean) | null) => void
  busyConfirmMessage: string
  unsavedConfirmMessage: string
}

export function useAgreementDraftCloseGuard({
  draft,
  baselineDraft,
  isBusy,
  savedAgreement,
  autosaveState,
  onClose,
  registerCloseGuard,
  busyConfirmMessage,
  unsavedConfirmMessage,
}: UseAgreementDraftCloseGuardInput): () => void {
  const initialDraftSignatureRef = useRef(JSON.stringify(baselineDraft ?? draft))

  const canClose = useCallback(() => {
    if (isBusy) {
      return window.confirm(busyConfirmMessage)
    }

    if (!savedAgreement) {
      const hasUnsavedChanges = JSON.stringify(draft) !== initialDraftSignatureRef.current
      return !hasUnsavedChanges || window.confirm(unsavedConfirmMessage)
    }

    if (autosaveState === 'saved' || autosaveState === 'idle') return true
    return window.confirm(unsavedConfirmMessage)
  }, [autosaveState, busyConfirmMessage, draft, isBusy, savedAgreement, unsavedConfirmMessage])

  useEffect(() => {
    if (!registerCloseGuard) return undefined
    registerCloseGuard(canClose)
    return () => registerCloseGuard(null)
  }, [canClose, registerCloseGuard])

  return useCallback(() => {
    if (canClose()) onClose()
  }, [canClose, onClose])
}
