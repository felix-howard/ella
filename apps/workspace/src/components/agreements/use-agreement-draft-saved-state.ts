import { useCallback, useState } from 'react'
import type { Agreement } from '../../lib/api-client'
import { createStep3ResolvedFromAgreement } from './agreement-draft-payload'
import type { Step3Resolved } from './wizard-steps/step3-content-editor'

export interface AgreementDraftSavedState {
  agreement: Agreement
  resolved: Step3Resolved
}

interface UseAgreementDraftSavedStateInput {
  existingDraft?: Agreement
  savedState?: AgreementDraftSavedState | null
  onSavedStateChange?: (state: AgreementDraftSavedState | null) => void
}

interface UseAgreementDraftSavedStateResult {
  savedAgreement: Agreement | null
  savedResolved: Step3Resolved | null
  setSavedDraft: (agreement: Agreement, resolved: Step3Resolved) => void
}

export function useAgreementDraftSavedState({
  existingDraft,
  savedState,
  onSavedStateChange,
}: UseAgreementDraftSavedStateInput): UseAgreementDraftSavedStateResult {
  const [localSavedState, setLocalSavedState] = useState<AgreementDraftSavedState | null>(() =>
    existingDraft
      ? { agreement: existingDraft, resolved: createStep3ResolvedFromAgreement(existingDraft) }
      : null,
  )
  const activeSavedState = savedState !== undefined ? savedState : localSavedState
  const setSavedDraft = useCallback((agreement: Agreement, resolved: Step3Resolved) => {
    const nextState = { agreement, resolved }
    setLocalSavedState(nextState)
    onSavedStateChange?.(nextState)
  }, [onSavedStateChange])

  return {
    savedAgreement: activeSavedState?.agreement ?? null,
    savedResolved: activeSavedState?.resolved ?? null,
    setSavedDraft,
  }
}
