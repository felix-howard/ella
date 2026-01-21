/**
 * FieldVerificationItem - Compact field component for verification workflows
 * Displays field value with verify/edit/unreadable action buttons on hover
 * Supports inline editing with auto-save on blur (per validation decisions)
 * Compact mode: inline layout with icon-only buttons for 8-10 fields visible
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn, Button, Input } from '@ella/ui'
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
  /** Enable compact mode - inline layout with icon-only buttons (default true) */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

// Status border/bg styles
const STATUS_STYLES: Record<string, string> = {
  verified: 'border-primary/50 bg-primary/5',
  edited: 'border-blue-300 bg-blue-50',
  unreadable: 'border-error/50 bg-error/5',
}

export function FieldVerificationItem({
  fieldKey,
  label,
  value,
  status,
  onVerify,
  disabled = false,
  compact = true,
  className,
}: FieldVerificationItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [justSaved, setJustSaved] = useState(false)
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
      // Show brief saved feedback
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1000)
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

  // Compact mode: inline layout with click-to-edit
  if (compact) {
    return (
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 border rounded transition-all duration-300',
          status ? STATUS_STYLES[status] : 'border-border bg-card hover:bg-muted/30',
          justSaved && 'border-primary/50 bg-primary/10',
          disabled && 'opacity-60',
          !isEditing && !disabled && 'cursor-pointer',
          className
        )}
        data-field-key={fieldKey}
        onClick={!isEditing && !disabled ? handleStartEdit : undefined}
      >
        {/* Status indicator with icon for colorblind accessibility */}
        {status && (
          <div
            className="flex-shrink-0"
            title={status === 'verified' ? 'Đã xác minh' : status === 'edited' ? 'Đã sửa' : 'Không đọc được'}
          >
            {status === 'verified' && <Check className="w-3.5 h-3.5 text-primary" />}
            {status === 'edited' && <Pencil className="w-3.5 h-3.5 text-blue-500" />}
            {status === 'unreadable' && <AlertTriangle className="w-3.5 h-3.5 text-error" />}
          </div>
        )}

        {/* Save feedback indicator */}
        {justSaved && !status && (
          <Check className="w-3.5 h-3.5 text-primary animate-pulse flex-shrink-0" />
        )}

        {/* Label */}
        <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[80px]">{label}:</span>

        {/* Value / Edit input */}
        {isEditing ? (
          <div className="flex-1 flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 h-7 text-sm py-0 px-2 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0"
              inputSize="sm"
            />
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded hover:bg-muted"
              aria-label="Hủy"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <span className="flex-1 text-sm font-medium text-foreground truncate">
            {value || <span className="text-muted-foreground italic">Trống</span>}
          </span>
        )}

        {/* Edit icon - visible on hover when not editing */}
        {!isEditing && !disabled && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    )
  }

  // Non-compact mode: stacked layout with click-to-edit
  return (
    <div
      className={cn(
        'group p-3 border rounded-lg transition-colors',
        status ? STATUS_STYLES[status] : 'border-border bg-card hover:bg-muted/30',
        disabled && 'opacity-60',
        !isEditing && !disabled && 'cursor-pointer',
        className
      )}
      data-field-key={fieldKey}
      onClick={!isEditing && !disabled ? handleStartEdit : undefined}
    >
      {/* Label */}
      <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
        <span>{label}</span>
        {/* Edit icon - visible on hover */}
        {!isEditing && !disabled && (
          <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Value / Edit input */}
      {isEditing ? (
        <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 h-8 text-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0"
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

      {/* Status indicator with icon for colorblind accessibility */}
      {status && (
        <div className="flex items-center gap-1.5 mt-2">
          {status === 'verified' && <Check className="w-3.5 h-3.5 text-primary" />}
          {status === 'edited' && <Pencil className="w-3.5 h-3.5 text-blue-500" />}
          {status === 'unreadable' && <AlertTriangle className="w-3.5 h-3.5 text-error" />}
          <span className="text-xs text-muted-foreground">
            {status === 'verified' ? 'Đã xác minh' : status === 'edited' ? 'Đã sửa' : 'Không đọc được'}
          </span>
        </div>
      )}
    </div>
  )
}
