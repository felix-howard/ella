/**
 * useAutoHide - Auto-hide UI elements after inactivity
 * Shows controls on interaction, hides after configurable delay
 * Handles cleanup on unmount
 */
import { useState, useCallback, useEffect, useRef } from 'react'

const DEFAULT_HIDE_DELAY = 3000

export interface UseAutoHideOptions {
  /** Delay in ms before hiding (default: 3000) */
  delay?: number
  /** Start visible (default: true) */
  initialVisible?: boolean
}

export interface UseAutoHideReturn {
  /** Whether the element should be visible */
  visible: boolean
  /** Call to show element and reset hide timer */
  show: () => void
}

export function useAutoHide(options: UseAutoHideOptions = {}): UseAutoHideReturn {
  const { delay = DEFAULT_HIDE_DELAY, initialVisible = true } = options

  const [visible, setVisible] = useState(initialVisible)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear existing timeout helper
  const clearHideTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Show and reset timer - callable from outside
  const show = useCallback(() => {
    setVisible(true)
    clearHideTimeout()
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, delay)
  }, [clearHideTimeout, delay])

  // Start hide timer on mount (visible starts as true)
  useEffect(() => {
    if (initialVisible) {
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
      }, delay)
    }

    // Cleanup on unmount
    return clearHideTimeout
  }, [initialVisible, clearHideTimeout, delay])

  return { visible, show }
}
