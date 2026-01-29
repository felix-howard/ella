/**
 * Field Edit Form - Inline editing component for OCR extracted fields
 * Supports text, number, and date field types with validation
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@ella/ui'
import { Check, X, DollarSign, Calendar, Type } from 'lucide-react'

export interface FieldEditFormProps {
  fieldKey: string
  label: string
  value: unknown
  type: 'text' | 'number' | 'date'
  onSave: (value: unknown) => void
  onCancel: () => void
}

export function FieldEditForm({
  fieldKey: _fieldKey,
  label,
  value,
  type,
  onSave,
  onCancel,
}: FieldEditFormProps) {
  const [localValue, setLocalValue] = useState(formatValueForInput(value, type))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Prevents auto-save on blur when user clicks Cancel
  const cancellingRef = useRef(false)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSave = () => {
    // Validate based on type
    const validationResult = validateValue(localValue, type)
    if (!validationResult.valid) {
      setError(validationResult.error)
      return
    }

    // Convert to appropriate type
    const convertedValue = convertValue(localValue, type)
    onSave(convertedValue)
  }

  const handleBlur = () => {
    // Skip auto-save if user is clicking Cancel
    if (cancellingRef.current) {
      cancellingRef.current = false
      return
    }
    handleSave()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  // TypeIcon available for future use
  const _TypeIcon = getTypeIcon(type)

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {type === 'number' && (
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type={getInputType(type)}
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={cn(
              'w-full rounded-lg border bg-card text-foreground',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'transition-colors',
              type === 'number' ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              error ? 'border-error' : 'border-border'
            )}
            placeholder={getPlaceholder(type)}
          />
        </div>
        <button
          onClick={handleSave}
          className={cn(
            'p-2 rounded-lg bg-primary text-white',
            'hover:bg-primary-dark transition-colors'
          )}
          aria-label="Lưu"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onMouseDown={() => { cancellingRef.current = true }}
          onClick={onCancel}
          className={cn(
            'p-2 rounded-lg bg-muted text-muted-foreground',
            'hover:bg-muted/80 transition-colors'
          )}
          aria-label="Hủy"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Enter để lưu • Escape để hủy • Tự lưu khi rời ô
      </p>
    </div>
  )
}

/**
 * Format value for input based on type
 */
function formatValueForInput(value: unknown, type: 'text' | 'number' | 'date'): string {
  if (value === null || value === undefined) return ''

  if (type === 'number') {
    // Remove currency formatting if present
    if (typeof value === 'string') {
      return value.replace(/[$,]/g, '')
    }
    return String(value)
  }

  if (type === 'date') {
    // Format as YYYY-MM-DD for date input
    if (typeof value === 'string') {
      try {
        const date = new Date(value)
        return date.toISOString().split('T')[0]
      } catch {
        return value
      }
    }
  }

  return String(value)
}

/**
 * Get HTML input type based on field type
 */
function getInputType(type: 'text' | 'number' | 'date'): string {
  switch (type) {
    case 'number':
      return 'text' // Use text for better formatting control
    case 'date':
      return 'date'
    default:
      return 'text'
  }
}

/**
 * Get icon for field type
 */
function getTypeIcon(type: 'text' | 'number' | 'date') {
  switch (type) {
    case 'number':
      return DollarSign
    case 'date':
      return Calendar
    default:
      return Type
  }
}

/**
 * Get placeholder text based on type
 */
function getPlaceholder(type: 'text' | 'number' | 'date'): string {
  switch (type) {
    case 'number':
      return 'Nhập số...'
    case 'date':
      return 'Chọn ngày...'
    default:
      return 'Nhập giá trị...'
  }
}

/**
 * Validate value based on type
 */
function validateValue(
  value: string,
  type: 'text' | 'number' | 'date'
): { valid: boolean; error: string | null } {
  if (!value.trim()) {
    return { valid: true, error: null } // Allow empty values
  }

  if (type === 'number') {
    // Remove currency symbols and commas for validation
    const cleanedValue = value.replace(/[$,]/g, '')
    const num = parseFloat(cleanedValue)
    if (isNaN(num)) {
      return { valid: false, error: 'Vui lòng nhập số hợp lệ' }
    }
    if (num < 0) {
      return { valid: false, error: 'Số không được âm' }
    }
  }

  if (type === 'date') {
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Vui lòng nhập ngày hợp lệ' }
    }
  }

  return { valid: true, error: null }
}

/**
 * Convert string value to appropriate type
 */
function convertValue(value: string, type: 'text' | 'number' | 'date'): unknown {
  if (!value.trim()) return null

  if (type === 'number') {
    const cleanedValue = value.replace(/[$,]/g, '')
    return parseFloat(cleanedValue)
  }

  // Keep dates and text as strings
  return value
}

/**
 * Compact field row for data entry mode - shows value with one-click copy
 */
export interface FieldCopyRowProps {
  label: string
  value: unknown
  onCopy: () => void
  copied?: boolean
  onEdit?: () => void
  compact?: boolean
}

export function FieldCopyRow({
  label,
  value,
  onCopy,
  copied,
  onEdit: _onEdit,
  compact,
}: FieldCopyRowProps) {
  const displayValue = value !== null && value !== undefined && value !== ''
    ? String(value)
    : null

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-lg transition-colors',
        compact ? 'py-1.5 px-2' : 'py-2 px-3',
        'hover:bg-muted/50'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {label}
        </p>
        {displayValue ? (
          <p className={cn('font-medium text-foreground truncate', compact ? 'text-sm' : 'text-base')}>
            {displayValue}
          </p>
        ) : (
          <p className={cn('text-muted-foreground italic', compact ? 'text-sm' : 'text-base')}>
            —
          </p>
        )}
      </div>
      {displayValue && (
        <button
          onClick={onCopy}
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg',
            'text-sm font-medium transition-colors',
            copied
              ? 'bg-success/10 text-success'
              : 'bg-primary text-white hover:bg-primary-dark',
            'opacity-0 group-hover:opacity-100 focus:opacity-100'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Đã copy</span>
            </>
          ) : (
            <span>Copy</span>
          )}
        </button>
      )}
    </div>
  )
}
