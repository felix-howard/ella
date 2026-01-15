/**
 * useCopyTracking - Hook for managing copy tracking state
 * Tracks which fields have been copied for a document (OltPro data entry)
 * Separated from component file to fix Fast Refresh warning
 */

import { useState, useCallback } from 'react'

export interface CopyProgress {
  copied: number
  total: number
  percentage: number
}

export interface CopyTrackingReturn {
  /** Set of copied field keys */
  copiedFields: Set<string>
  /** Mark a field as copied */
  markCopied: (fieldKey: string) => void
  /** Reset all copied fields */
  resetCopied: () => void
  /** Check if a field is copied */
  isCopied: (fieldKey: string) => boolean
  /** Get array of copied field keys */
  getCopiedFields: () => string[]
  /** Get copy progress stats */
  getCopyProgress: (totalFields: number) => CopyProgress
}

/**
 * Hook for managing copy tracking state
 * @param initialCopied - Initial list of copied field keys
 */
export function useCopyTracking(initialCopied: string[] = []): CopyTrackingReturn {
  const [copiedFields, setCopiedFields] = useState<Set<string>>(
    new Set(initialCopied)
  )

  const markCopied = useCallback((fieldKey: string) => {
    setCopiedFields((prev) => new Set([...prev, fieldKey]))
  }, [])

  const resetCopied = useCallback(() => {
    setCopiedFields(new Set())
  }, [])

  const isCopied = useCallback(
    (fieldKey: string) => copiedFields.has(fieldKey),
    [copiedFields]
  )

  const getCopiedFields = useCallback(
    () => Array.from(copiedFields),
    [copiedFields]
  )

  const getCopyProgress = useCallback(
    (totalFields: number): CopyProgress => ({
      copied: copiedFields.size,
      total: totalFields,
      percentage:
        totalFields > 0 ? Math.round((copiedFields.size / totalFields) * 100) : 0,
    }),
    [copiedFields]
  )

  return {
    copiedFields,
    markCopied,
    resetCopied,
    isCopied,
    getCopiedFields,
    getCopyProgress,
  }
}
