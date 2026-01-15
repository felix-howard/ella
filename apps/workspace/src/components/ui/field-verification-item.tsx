/**
 * FieldVerificationItem - Field component for verification workflows
 * Displays field value with verify/edit/unreadable action buttons
 * Supports inline editing with auto-save on blur (per validation decisions)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn, Button, Input, Badge } from '@ella/ui'
import { Check, Pencil, AlertTriangle, X } from 'lucide-react'

export type FieldVerificationStatus = 'verified' | 'edited' | 'unreadable' | null

export interface FieldVerificationItemProps {
  /** Unique field key */
  fieldKey: string
  /** Display label */
  label: string
  /** Current value */
  value: string
  /** Verification status */
  status?: FieldVerificationStatus
  /** Callback when field is verified/edited/marked unreadable */
  onVerify: (
    status: 'verified' | 'edited' | 'unreadable',
    newValue?: string
  ) => void
  /** Whether field is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  verified: 'border-primary bg-primary-light/30',
  edited: 'border-blue-300 bg-blue-50',
  unreadable: 'border-error bg-error-light/30',
}

const STATUS_LABELS: Record<string, string> = {
  verified: 'Đã xác minh',
  edited: 'Đã sửa',
  unreadable: 'Không đọc được',
}

export function FieldVerificationItem({
  fieldKey,
  label,
  value,
  status,
  onVerify,
  disabled = false,
  className,
}: FieldVerificationItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update editValue when value prop changes
  useEffect(() => {
    setEditValue(value)
  }, [value])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value)
  }, [disabled, value])

  const handleSaveEdit = useCallback(() => {
    const trimmedValue = editValue.trim()
    if (trimmedValue !== value) {
      onVerify('edited', trimmedValue)
    }
    setIsEditing(false)
  }, [editValue, value, onVerify])

  const handleCancelEdit = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
  }, [value])

  const handleBlur = useCallback(() => {
    // Auto-save on blur (per validation decision: auto-save on blur immediate)
    handleSaveEdit()
  }, [handleSaveEdit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSaveEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit]
  )

  const handleVerify = useCallback(() => {
    if (disabled) return
    onVerify('verified')
  }, [disabled, onVerify])

  const handleMarkUnreadable = useCallback(() => {
    if (disabled) return
    onVerify('unreadable')
  }, [disabled, onVerify])

  return (
    <div
      className={cn(
        'p-3 border rounded-lg transition-colors',
        status ? STATUS_STYLES[status] : 'border-border bg-card',
        disabled && 'opacity-60',
        className
      )}
      data-field-key={fieldKey}
    >
      {/* Label */}
      <div className="text-xs text-secondary mb-1">{label}</div>

      {/* Value / Edit input */}
      {isEditing ? (
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 h-8 text-sm"
            inputSize="sm"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancelEdit}
            className="h-8 w-8 p-0"
            aria-label="Hủy"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="font-medium text-foreground">
          {value || <span className="text-muted-foreground italic">Trống</span>}
        </div>
      )}

      {/* Action buttons - show only when not verified and not editing */}
      {!isEditing && !status && !disabled && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleVerify}
            className="h-7 text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Đúng
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartEdit}
            className="h-7 text-xs"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Sửa
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkUnreadable}
            className="h-7 text-xs text-error hover:text-error"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Không đọc được
          </Button>
        </div>
      )}

      {/* Status badge */}
      {status && (
        <Badge
          className="mt-2"
          variant={status === 'unreadable' ? 'error' : status === 'edited' ? 'secondary' : 'success'}
          size="sm"
        >
          {STATUS_LABELS[status]}
        </Badge>
      )}
    </div>
  )
}
