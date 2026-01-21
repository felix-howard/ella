/**
 * useDebouncedValue hook - Debounces a value with configurable delay
 * Returns the debounced value and a pending state
 */

import { useState, useEffect } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): [T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState(value)

  // Determine if pending based on value comparison
  const isPending = value !== debouncedValue

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return [debouncedValue, isPending]
}
