/**
 * useDebounced save - Hook for debounced auto-save functionality
 * Provides debounced save with visual feedback (isSaving state)
 */

import { useCallback, useRef, useState, useEffect } from 'react'

interface UseDebouncedSaveOptions<T> {
  /** Delay in milliseconds before save triggers (default: 1500ms) */
  delay?: number
  /** Save function that receives the data to save */
  onSave: (data: T) => Promise<void>
  /** Callback on successful save */
  onSuccess?: () => void
  /** Callback on save error */
  onError?: (error: Error) => void
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean
}

interface UseDebouncedSaveReturn<T> {
  /** Trigger a save with new data (debounced) */
  save: (data: T) => void
  /** Force immediate save (skips debounce) */
  saveNow: (data: T) => Promise<void>
  /** Cancel pending save */
  cancel: () => void
  /** Whether a save is in progress */
  isSaving: boolean
  /** Whether there's a pending save */
  isPending: boolean
  /** Last error if any */
  error: Error | null
}

export function useDebouncedSave<T>({
  delay = 1500,
  onSave,
  onSuccess,
  onError,
  enabled = true,
}: UseDebouncedSaveOptions<T>): UseDebouncedSaveReturn<T> {
  const [isSaving, setIsSaving] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingDataRef = useRef<T | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const executeSave = useCallback(async (data: T) => {
    if (!isMountedRef.current) return

    setIsSaving(true)
    setError(null)

    try {
      await onSave(data)
      if (isMountedRef.current) {
        onSuccess?.()
      }
    } catch (err) {
      const saveError = err instanceof Error ? err : new Error('Save failed')
      if (isMountedRef.current) {
        setError(saveError)
        onError?.(saveError)
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
        setIsPending(false)
        pendingDataRef.current = null
      }
    }
  }, [onSave, onSuccess, onError])

  const save = useCallback((data: T) => {
    if (!enabled) return

    // Cancel previous timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Store pending data
    pendingDataRef.current = data
    setIsPending(true)
    setError(null)

    // Schedule save
    timeoutRef.current = setTimeout(() => {
      executeSave(data)
    }, delay)
  }, [enabled, delay, executeSave])

  const saveNow = useCallback(async (data: T) => {
    // Cancel pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    await executeSave(data)
  }, [executeSave])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingDataRef.current = null
    setIsPending(false)
  }, [])

  return {
    save,
    saveNow,
    cancel,
    isSaving,
    isPending,
    error,
  }
}
