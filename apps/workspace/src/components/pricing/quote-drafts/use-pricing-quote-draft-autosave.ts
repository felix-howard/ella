import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import { api, ApiError, type PricingQuoteDraftDetail } from '../../../lib/api-client'
import { pricingQuoteDraftSignature } from './pricing-quote-draft-types'
import { pricingQuoteDraftKeys } from './use-pricing-quote-drafts'

export type PricingQuoteDraftAutosaveState =
  | 'idle'
  | 'saved'
  | 'unsaved'
  | 'saving'
  | 'failed'
  | 'conflict'

interface UsePricingQuoteDraftAutosaveInput {
  draftId: string | null
  pricingInput: PricingCalculatorInput
  updatedAt: string | null
  enabled: boolean
  onSaved: (draft: PricingQuoteDraftDetail) => void
  onConflict: (error: Error) => void
}

interface UsePricingQuoteDraftAutosaveResult {
  state: PricingQuoteDraftAutosaveState
  resetSavedBaseline: (pricingInput: PricingCalculatorInput | null) => void
  saveNow: () => Promise<string>
  pause: () => void
  resume: () => void
}

const AUTOSAVE_DELAY_MS = 1000

export function usePricingQuoteDraftAutosave({
  draftId,
  pricingInput,
  updatedAt,
  enabled,
  onSaved,
  onConflict,
}: UsePricingQuoteDraftAutosaveInput): UsePricingQuoteDraftAutosaveResult {
  const { orgId } = useAuth()
  const queryClient = useQueryClient()
  const [state, setState] = useState<PricingQuoteDraftAutosaveState>('idle')
  const [saveNonce, setSaveNonce] = useState(0)
  const savedSignatureRef = useRef<string | null>(null)
  const failedSignatureRef = useRef<string | null>(null)
  const currentRequestRef = useRef<Promise<string> | null>(null)
  const currentRequestSignatureRef = useRef<string | null>(null)
  const latestUpdatedAtRef = useRef(updatedAt)
  const manuallyPausedRef = useRef(false)
  const conflictRef = useRef(false)
  const mountedRef = useRef(true)
  const inputRef = useRef(pricingInput)
  const signature = useMemo(() => pricingQuoteDraftSignature(pricingInput), [pricingInput])
  const signatureRef = useRef(signature)
  const onSavedRef = useRef(onSaved)
  const onConflictRef = useRef(onConflict)

  inputRef.current = pricingInput
  signatureRef.current = signature
  onSavedRef.current = onSaved
  onConflictRef.current = onConflict

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!currentRequestRef.current) latestUpdatedAtRef.current = updatedAt
  }, [draftId, updatedAt])

  const resetSavedBaseline = useCallback((nextInput: PricingCalculatorInput | null) => {
    savedSignatureRef.current = nextInput ? pricingQuoteDraftSignature(nextInput) : null
    failedSignatureRef.current = null
    conflictRef.current = false
    if (mountedRef.current) setState(nextInput ? 'saved' : 'idle')
  }, [])

  const pause = useCallback(() => {
    manuallyPausedRef.current = true
    setSaveNonce((current) => current + 1)
  }, [])

  const resume = useCallback(() => {
    manuallyPausedRef.current = false
    setSaveNonce((current) => current + 1)
  }, [])

  const saveNow = useCallback(function persistLatest(): Promise<string> {
    const nextSignature = signatureRef.current
    const expectedUpdatedAt = latestUpdatedAtRef.current
    if (!enabled || !draftId || !expectedUpdatedAt) {
      return Promise.reject(new Error('Pricing quote draft is not ready to save'))
    }
    if (conflictRef.current) {
      return Promise.reject(new Error('Pricing quote draft changed elsewhere'))
    }
    if (savedSignatureRef.current === nextSignature) {
      if (mountedRef.current) setState('saved')
      return Promise.resolve(expectedUpdatedAt)
    }

    const currentRequest = currentRequestRef.current
    if (currentRequest) {
      if (currentRequestSignatureRef.current === nextSignature) return currentRequest
      return currentRequest.then(() => persistLatest())
    }

    currentRequestSignatureRef.current = nextSignature
    if (mountedRef.current) setState('saving')
    const request = api.billing
      .updatePricingQuoteDraft(draftId, {
        pricingInput: inputRef.current,
        expectedUpdatedAt,
      })
      .then((draft) => {
        savedSignatureRef.current = nextSignature
        failedSignatureRef.current = null
        conflictRef.current = false
        latestUpdatedAtRef.current = draft.updatedAt
        if (mountedRef.current) {
          setState('saved')
          onSavedRef.current(draft)
          void queryClient.invalidateQueries({ queryKey: pricingQuoteDraftKeys.list(orgId) })
        }
        return draft.updatedAt
      })
      .catch((error: Error) => {
        if (isPricingQuoteDraftConflict(error)) {
          conflictRef.current = true
          if (mountedRef.current) {
            setState('conflict')
            onConflictRef.current(error)
          }
        } else {
          failedSignatureRef.current = nextSignature
          if (mountedRef.current) setState('failed')
        }
        throw error
      })
      .finally(() => {
        currentRequestRef.current = null
        currentRequestSignatureRef.current = null
        if (mountedRef.current) setSaveNonce((current) => current + 1)
      })

    currentRequestRef.current = request
    return request
  }, [draftId, enabled, orgId, queryClient])

  useEffect(() => {
    if (!enabled || !draftId) {
      savedSignatureRef.current = null
      failedSignatureRef.current = null
      conflictRef.current = false
      setState('idle')
      return
    }
    if (savedSignatureRef.current === null) {
      savedSignatureRef.current = signature
      setState('saved')
      return
    }
    if (savedSignatureRef.current === signature) {
      failedSignatureRef.current = null
      setState((current) => (current === 'saving' ? current : 'saved'))
      return
    }
    if (conflictRef.current) {
      setState('conflict')
      return
    }
    if (currentRequestRef.current) {
      setState('saving')
      return
    }
    if (failedSignatureRef.current === signature) {
      setState('failed')
      return
    }

    setState('unsaved')
    if (manuallyPausedRef.current || !updatedAt) return
    const timeoutId = window.setTimeout(() => {
      void saveNow().catch(() => undefined)
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [draftId, enabled, saveNonce, saveNow, signature, updatedAt])

  return { state, resetSavedBaseline, saveNow, pause, resume }
}

export function isPricingQuoteDraftConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'PRICING_QUOTE_DRAFT_CONFLICT'
  )
}
