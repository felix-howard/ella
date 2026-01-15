/**
 * CopyableField - Field component for copy tracking (OltPro data entry)
 * Displays field value with copy-to-clipboard button and persisted checkbox
 * Used for tracking which fields have been copied to external systems
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn, Button } from '@ella/ui'
import { Copy, Check, CheckCircle2, Circle } from 'lucide-react'
import { toast } from '../../stores/toast-store'

export interface CopyableFieldProps {
  /** Unique field key */
  fieldKey: string
  /** Display label */
  label: string
  /** Current value to copy */
  value: string
  /** Whether field has been copied (persisted state) */
  isCopied?: boolean
  /** Callback when field is copied */
  onCopy: (fieldKey: string) => void
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

  // Cleanup timeout on unmount to prevent memory leak
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
      onCopy(fieldKey)

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
      // User feedback on clipboard failure
      console.error('Failed to copy to clipboard:', err)
      toast.error('Không thể sao chép. Vui lòng thử lại.')
    }
  }, [disabled, value, fieldKey, onCopy])

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 border rounded-lg transition-colors',
        isCopied ? 'border-primary/50 bg-primary-light/20' : 'border-border bg-card',
        disabled && 'opacity-60',
        className
      )}
      data-field-key={fieldKey}
    >
      {/* Label and value */}
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-xs text-secondary mb-0.5">{label}</div>
        <div className="font-medium text-foreground truncate">
          {value || <span className="text-muted-foreground italic">Trống</span>}
        </div>
      </div>

      {/* Copy button and status indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          disabled={disabled || !value}
          className={cn('h-8 w-8 p-0', justCopied && 'text-primary')}
          aria-label={justCopied ? 'Đã sao chép' : 'Sao chép'}
          title={justCopied ? 'Đã sao chép' : 'Sao chép'}
        >
          {justCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>

        {/* Persisted copy status indicator */}
        <div
          className={cn(
            'transition-colors',
            isCopied ? 'text-primary' : 'text-muted-foreground'
          )}
          aria-label={isCopied ? 'Đã sao chép' : 'Chưa sao chép'}
          title={isCopied ? 'Đã sao chép' : 'Chưa sao chép'}
        >
          {isCopied ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </div>
      </div>
    </div>
  )
}
