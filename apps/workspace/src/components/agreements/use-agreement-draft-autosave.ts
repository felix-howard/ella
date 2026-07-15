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
  saveNow: () => Promise<void>
  pause: () => void
  resume: () => void
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
  const currentSaveRequestRef = useRef<Promise<void> | null>(null)
  const currentSaveSignatureRef = useRef<string | null>(null)
  const latestUpdatedAtRef = useRef(updatedAt)
  const manuallyPausedRef = useRef(false)

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

  useEffect(() => {
    if (!currentSaveRequestRef.current) latestUpdatedAtRef.current = updatedAt
  }, [updatedAt])

  const pause = useCallback(() => {
    manuallyPausedRef.current = true
    setSaveNonce((current) => current + 1)
  }, [])

  const resume = useCallback(() => {
    manuallyPausedRef.current = false
    setSaveNonce((current) => current + 1)
  }, [])

  const saveNow = useCallback(function persistNow(): Promise<void> {
    const expectedUpdatedAt = latestUpdatedAtRef.current
    if (!enabled || !draftAgreementId || !payload || !payloadSignature || !expectedUpdatedAt) {
      return Promise.reject(new Error('Agreement draft is not ready to save'))
    }

    if (savedSignatureRef.current === payloadSignature) {
      setState('saved')
      return Promise.resolve()
    }

    const currentRequest = currentSaveRequestRef.current
    if (currentRequest) {
      if (currentSaveSignatureRef.current === payloadSignature) return currentRequest
      return currentRequest.then(() => persistNow())
    }

    const updatePayload = buildAgreementDraftAutosaveUpdatePayload(payload, expectedUpdatedAt)
    savingRef.current = true
    currentSaveSignatureRef.current = payloadSignature
    setState('saving')

    const request = agreementsApi(entity)
      .updateDraft(entity.id, draftAgreementId, updatePayload)
      .then((res) => {
        savedSignatureRef.current = payloadSignature
        failedSignatureRef.current = null
        conflictRef.current = false
        latestUpdatedAtRef.current = res.data.updatedAt
        setState('saved')
        onSaved(res.data)
        invalidate()
      })
      .catch((error: Error) => {
        if (isAgreementDraftConflict(error)) {
          conflictRef.current = true
          setState('conflict')
          onConflict(error)
        } else {
          failedSignatureRef.current = payloadSignature
          setState('failed')
        }
        throw error
      })
      .finally(() => {
        savingRef.current = false
        currentSaveRequestRef.current = null
        currentSaveSignatureRef.current = null
        setSaveNonce((current) => current + 1)
      })

    currentSaveRequestRef.current = request
    return request
  }, [
    draftAgreementId,
    enabled,
    entity,
    invalidate,
    onConflict,
    onSaved,
    payload,
    payloadSignature,
  ])

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

    if (savingRef.current || currentSaveRequestRef.current) {
      setState('saving')
      return
    }

    if (!updatedAt || paused || manuallyPausedRef.current) {
      setState('unsaved')
      return
    }

    setState('unsaved')
    const timeoutId = window.setTimeout(() => {
      void saveNow().catch(() => undefined)
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [
    draftAgreementId,
    enabled,
    paused,
    payload,
    payloadSignature,
    saveNow,
    saveNonce,
    updatedAt,
  ])
  return { state, resetSavedBaseline, saveNow, pause, resume }
}
