import { useCallback, useEffect, useRef, useState } from 'react'
import type { Agreement } from '../../lib/api-client'
import type { AgreementDraftAutosaveState } from './use-agreement-draft-autosave'
import type { Step3Draft } from './wizard-steps/step3-content-editor'

interface UseAgreementDraftCloseGuardInput {
  draft: Step3Draft
  baselineDraft?: Step3Draft
  hasExternalUnsavedChanges?: boolean
  isBusy: boolean
  savedAgreement: Agreement | null
  autosaveState: AgreementDraftAutosaveState
  onClose: () => void
  registerCloseGuard?: (guard: AgreementDraftCloseGuard | null) => void
  onConfirmationOpen?: () => void
  onConfirmationDismiss?: () => void
}

export type AgreementDraftCloseGuard = (continuation: () => void) => void

interface UseAgreementDraftCloseGuardResult {
  requestClose: () => void
  confirmationOpen: boolean
  confirmationBusy: boolean
  dismissConfirmation: () => void
  continueWithoutSaving: () => void
  continueAfterSaving: () => void
}

export function useAgreementDraftCloseGuard({
  draft,
  baselineDraft,
  hasExternalUnsavedChanges = false,
  isBusy,
  savedAgreement,
  autosaveState,
  onClose,
  registerCloseGuard,
  onConfirmationOpen,
  onConfirmationDismiss,
}: UseAgreementDraftCloseGuardInput): UseAgreementDraftCloseGuardResult {
  const initialDraftSignatureRef = useRef(JSON.stringify(baselineDraft ?? draft))
  const pendingContinuationRef = useRef<(() => void) | null>(null)
  const confirmationOpenRef = useRef(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const hasChangesToConfirm = useCallback(() => {
    if (isBusy) return true
    if (hasExternalUnsavedChanges) return true
    if (!savedAgreement) {
      const hasUnsavedChanges = JSON.stringify(draft) !== initialDraftSignatureRef.current
      return hasUnsavedChanges
    }
    return autosaveState !== 'saved' && autosaveState !== 'idle'
  }, [autosaveState, draft, hasExternalUnsavedChanges, isBusy, savedAgreement])

  const guardClose = useCallback<AgreementDraftCloseGuard>((continuation) => {
    if (confirmationOpenRef.current) return
    if (!hasChangesToConfirm()) {
      continuation()
      return
    }
    pendingContinuationRef.current = continuation
    confirmationOpenRef.current = true
    onConfirmationOpen?.()
    setConfirmationOpen(true)
  }, [hasChangesToConfirm, onConfirmationOpen])

  useEffect(() => {
    if (!registerCloseGuard) return undefined
    registerCloseGuard(guardClose)
    return () => registerCloseGuard(null)
  }, [guardClose, registerCloseGuard])

  const dismissConfirmation = useCallback(() => {
    pendingContinuationRef.current = null
    confirmationOpenRef.current = false
    onConfirmationDismiss?.()
    setConfirmationOpen(false)
  }, [onConfirmationDismiss])

  const runPendingContinuation = useCallback(() => {
    const continuation = pendingContinuationRef.current
    pendingContinuationRef.current = null
    confirmationOpenRef.current = false
    onConfirmationDismiss?.()
    setConfirmationOpen(false)
    continuation?.()
  }, [onConfirmationDismiss])

  const requestClose = useCallback(() => guardClose(onClose), [guardClose, onClose])

  return {
    requestClose,
    confirmationOpen,
    confirmationBusy: isBusy,
    dismissConfirmation,
    continueWithoutSaving: runPendingContinuation,
    continueAfterSaving: runPendingContinuation,
  }
}
