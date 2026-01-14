/**
 * useClipboard - Hook for clipboard operations with toast feedback
 * Provides copy function with success/error toast notifications
 */
import { useCallback } from 'react'
import { toast } from '../stores/toast-store'

interface UseClipboardOptions {
  /** Success message to show (default: "Đã copy!") */
  successMessage?: string
  /** Error message to show (default: "Không thể copy") */
  errorMessage?: string
  /** Callback after successful copy */
  onSuccess?: () => void
  /** Callback after failed copy */
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  /** Copy text to clipboard with toast feedback */
  copy: (text: string) => Promise<boolean>
  /** Copy formatted text (label: value pairs) */
  copyFormatted: (data: Record<string, unknown>) => Promise<boolean>
}

/**
 * Copy text to clipboard with fallback for older browsers
 * Handles both modern Clipboard API and legacy execCommand fallback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first (requires secure context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (clipboardError) {
      console.warn('Clipboard API failed, trying fallback:', clipboardError)
      // Fall through to legacy method
    }
  }

  // Fallback for older browsers or when Clipboard API fails
  let textArea: HTMLTextAreaElement | null = null
  try {
    textArea = document.createElement('textarea')
    textArea.value = text
    // Prevent scrolling to bottom on iOS
    textArea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    // Try to copy using deprecated execCommand
    const success = document.execCommand('copy')
    if (!success) {
      throw new Error('execCommand copy failed')
    }
    return true
  } catch (fallbackError) {
    console.error('Clipboard fallback failed:', fallbackError)
    return false
  } finally {
    // Always clean up textarea
    if (textArea && document.body.contains(textArea)) {
      document.body.removeChild(textArea)
    }
  }
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const {
    successMessage = 'Đã copy!',
    errorMessage = 'Không thể copy',
    onSuccess,
    onError,
  } = options

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text) {
        toast.error('Không có dữ liệu để copy')
        return false
      }

      const success = await copyToClipboard(text)

      if (success) {
        toast.success(successMessage)
        onSuccess?.()
      } else {
        toast.error(errorMessage)
        onError?.(new Error('Clipboard copy failed'))
      }

      return success
    },
    [successMessage, errorMessage, onSuccess, onError]
  )

  const copyFormatted = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const lines = Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)

      if (lines.length === 0) {
        toast.error('Không có dữ liệu để copy')
        return false
      }

      return copy(lines.join('\n'))
    },
    [copy]
  )

  return { copy, copyFormatted }
}
