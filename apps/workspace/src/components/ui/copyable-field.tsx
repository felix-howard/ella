/**
 * CopyableField - Compact field component for copy-to-clipboard
 * Shows label + value inline with a copy button
 * Displays checkmark briefly after copying (in-session only, not persisted)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@ella/ui'
import { Copy, Check } from 'lucide-react'
import { toast } from '../../stores/toast-store'

export interface CopyableFieldProps {
  /** Unique field key */
  fieldKey: string
  /** Display label */
  label: string
  /** Current value to copy */
  value: string
  /** Whether field has been copied (in-session state) */
  isCopied?: boolean
  /** Callback when field is copied */
  onCopy?: (fieldKey: string) => void
  /** Whether field is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export function CopyableField({
  fieldKey,
  label,
  value,
  isCopied = false,
  onCopy,
  disabled = false,
  className,
}: CopyableFieldProps) {
  const [justCopied, setJustCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (disabled || !value) return

    try {
      await navigator.clipboard.writeText(value)
      setJustCopied(true)
      onCopy?.(fieldKey)

      // Clear previous timeout if any
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Reset visual feedback after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setJustCopied(false)
        timeoutRef.current = null
      }, 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      toast.error('Không thể sao chép. Vui lòng thử lại.')
    }
  }, [disabled, value, fieldKey, onCopy])

  // Show check if just copied or marked as copied this session
  const showCheck = justCopied || isCopied

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors',
        disabled && 'opacity-60',
        className
      )}
      data-field-key={fieldKey}
    >
      {/* Label */}
      <span className="text-sm text-secondary min-w-[120px] flex-shrink-0">{label}:</span>

      {/* Value */}
      <span className="flex-1 text-sm font-medium text-foreground truncate">
        {value || <span className="text-muted-foreground italic">Trống</span>}
      </span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        disabled={disabled || !value}
        className={cn(
          'p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0',
          showCheck ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          (disabled || !value) && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={showCheck ? 'Đã sao chép' : 'Sao chép'}
        title={showCheck ? 'Đã sao chép' : 'Nhấn để sao chép'}
      >
        {showCheck ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}
