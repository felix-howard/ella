/**
 * useRentalAutoSave Hook
 * Debounced auto-save draft every 30 seconds after last change
 * Reuses patterns from expense auto-save with rental-specific API
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { rentalApi } from '../lib/rental-api'
import type { ScheduleEProperty } from '@ella/shared'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseRentalAutoSaveReturn {
  status: AutoSaveStatus
  lastSaved: Date | null
  error: string | null
  saveNow: () => Promise<void>
}

// Auto-save delay (30 seconds)
const AUTO_SAVE_DELAY = 30000

// Rate limiting: minimum 20 seconds between saves
const MIN_SAVE_INTERVAL = 20000

// Maximum saves per minute
const MAX_SAVES_PER_MINUTE = 3

// Retry config: exponential backoff (2s, 4s, 8s)
const MAX_RETRIES = 3
const RETRY_BASE_DELAY = 2000

export function useRentalAutoSave(
  token: string,
  properties: ScheduleEProperty[],
  isDirty: boolean,
  formStatus: string
): UseRentalAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs to track latest values without triggering re-renders
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const propertiesRef = useRef(properties)
  const isDirtyRef = useRef(isDirty)
  const isSavingRef = useRef(false)
  const lastSaveTimeRef = useRef<number>(0)
  const saveCountRef = useRef<number[]>([])
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs updated
  useEffect(() => {
    propertiesRef.current = properties
  }, [properties])

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Check rate limiting
  const canSave = useCallback(() => {
    const now = Date.now()

    // Check minimum interval
    if (now - lastSaveTimeRef.current < MIN_SAVE_INTERVAL) {
      return false
    }

    // Check saves per minute
    const oneMinuteAgo = now - 60000
    saveCountRef.current = saveCountRef.current.filter(ts => ts > oneMinuteAgo)
    if (saveCountRef.current.length >= MAX_SAVES_PER_MINUTE) {
      return false
    }

    return true
  }, [])

  // Save function with retry support
  const performSave = useCallback(async () => {
    // Don't save if form is being submitted
    if (formStatus === 'submitting' || formStatus === 'submitted') return

    // Don't save if already saving
    if (isSavingRef.current) return

    // Don't save if not dirty
    if (!isDirtyRef.current) return

    // Rate limiting check (skip during retries)
    if (retryCountRef.current === 0 && !canSave()) {
      return
    }

    isSavingRef.current = true
    setStatus('saving')
    setError(null)

    const saveStartTime = Date.now()

    try {
      await rentalApi.saveDraft(token, { properties: propertiesRef.current })

      // Reset retry counter on success
      retryCountRef.current = 0

      // Update rate limiting trackers
      const now = Date.now()
      lastSaveTimeRef.current = now
      saveCountRef.current.push(now)

      setLastSaved(new Date())

      // Timing: ensure 'saving' indicator visible ≥800ms to prevent flashing
      const elapsed = Date.now() - saveStartTime
      const remainingDelay = Math.max(0, 800 - elapsed)

      setTimeout(() => {
        setStatus('saved')
        setTimeout(() => {
          setStatus('idle')
        }, 3000)
      }, remainingDelay)
    } catch (err) {
      isSavingRef.current = false

      // Retry with exponential backoff
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCountRef.current - 1)
        retryTimerRef.current = setTimeout(() => {
          performSave()
        }, delay)
        return
      }

      // All retries exhausted - show error
      retryCountRef.current = 0
      const message = err instanceof Error ? err.message : 'Không thể lưu tự động'
      setError(message)
      setStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [token, formStatus, canSave])

  // Debounced auto-save effect
  useEffect(() => {
    // Don't start timer if not dirty or if form is being submitted
    if (!isDirty || formStatus === 'submitting' || formStatus === 'submitted') {
      return
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Start new timer
    timerRef.current = setTimeout(() => {
      performSave()
    }, AUTO_SAVE_DELAY)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [isDirty, properties, formStatus, performSave])

  // Force save function
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await performSave()
  }, [performSave])

  return {
    status,
    lastSaved,
    error,
    saveNow,
  }
}
