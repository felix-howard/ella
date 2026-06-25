import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Agreement,
  SaveAgreementDraftPayload,
  UpdateAgreementDraftPayload,
} from '../../lib/api-client'
import type { EntityRef } from './types'
import { createPayloadSignature } from './agreement-draft-payload'
import { isAgreementDraftConflict } from './use-agreement-draft-mutations'
import {
  agreementsApi,
  useInvalidateAgreements,
} from './use-agreement-mutations'

export type AgreementDraftAutosaveState =
  | 'idle'
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'failed'
  | 'conflict'

interface UseAgreementDraftAutosaveInput {
  entity: EntityRef
  draftAgreementId: string | null
  payload: SaveAgreementDraftPayload | null
  updatedAt: string | null
  enabled: boolean
  paused?: boolean
  onSaved: (agreement: Agreement) => void
  onConflict: (error: Error) => void
}

interface UseAgreementDraftAutosaveResult {
  state: AgreementDraftAutosaveState
  resetSavedBaseline: (payload: SaveAgreementDraftPayload | null) => void
}

const AUTOSAVE_DELAY_MS = 1000

export function buildAgreementDraftAutosaveUpdatePayload(
  payload: SaveAgreementDraftPayload,
  updatedAt: string,
): UpdateAgreementDraftPayload {
  return {
    ...payload,
    expectedUpdatedAt: updatedAt,
  }
}

export function useAgreementDraftAutosave({
  entity,
  draftAgreementId,
  payload,
  updatedAt,
  enabled,
  paused = false,
  onSaved,
  onConflict,
}: UseAgreementDraftAutosaveInput): UseAgreementDraftAutosaveResult {
  const invalidate = useInvalidateAgreements(entity)
  const [state, setState] = useState<AgreementDraftAutosaveState>('idle')
  const [saveNonce, setSaveNonce] = useState(0)
  const savedSignatureRef = useRef<string | null>(null)
  const failedSignatureRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  const conflictRef = useRef(false)

  const payloadSignature = useMemo(
    () => (payload ? createPayloadSignature(payload) : null),
    [payload],
  )

  const resetSavedBaseline = useCallback((nextPayload: SaveAgreementDraftPayload | null) => {
    savedSignatureRef.current = nextPayload ? createPayloadSignature(nextPayload) : null
    failedSignatureRef.current = null
    savingRef.current = false
    conflictRef.current = false
    setState(nextPayload ? 'saved' : 'idle')
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- autosave status intentionally mirrors draft identity before timers run */
  useEffect(() => {
    if (!enabled || !draftAgreementId || !payload || !payloadSignature) {
      setState('idle')
      savedSignatureRef.current = null
      failedSignatureRef.current = null
      savingRef.current = false
      conflictRef.current = false
      return
    }

    if (savedSignatureRef.current === null) {
      savedSignatureRef.current = payloadSignature
      setState('saved')
      return
    }

    if (savedSignatureRef.current === payloadSignature) {
      failedSignatureRef.current = null
      setState((current) => (current === 'saving' ? current : 'saved'))
      return
    }

    if (failedSignatureRef.current === payloadSignature) {
      setState('failed')
      return
    }

    if (conflictRef.current) {
      setState('conflict')
      return
    }

    if (!updatedAt || paused || savingRef.current) {
      setState('unsaved')
      return
    }

    setState('unsaved')
    const timeoutId = window.setTimeout(() => {
      const updatePayload = buildAgreementDraftAutosaveUpdatePayload(payload, updatedAt)
      savingRef.current = true
      setState('saving')
      agreementsApi(entity)
        .updateDraft(entity.id, draftAgreementId, updatePayload)
        .then((res) => {
          savedSignatureRef.current = payloadSignature
          failedSignatureRef.current = null
          setState('saved')
          onSaved(res.data)
          invalidate()
        })
        .catch((error: Error) => {
          if (isAgreementDraftConflict(error)) {
            conflictRef.current = true
            setState('conflict')
            onConflict(error)
            return
          }
          failedSignatureRef.current = payloadSignature
          setState('failed')
        })
        .finally(() => {
          savingRef.current = false
          setSaveNonce((current) => current + 1)
        })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [
    draftAgreementId,
    enabled,
    entity,
    invalidate,
    onConflict,
    onSaved,
    paused,
    payload,
    payloadSignature,
    saveNonce,
    updatedAt,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  return { state, resetSavedBaseline }
}
