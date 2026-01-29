/**
 * ExpenseField Component
 * Single expense input with label, tooltip, and optional unit
 * Optimized with memo to prevent unnecessary re-renders
 */
import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import type { ExpenseCategory } from '../lib/expense-categories'

interface ExpenseFieldProps {
  category: ExpenseCategory
  value: number | string | null
  onChange: (value: number | string | null) => void
  readOnly?: boolean
  error?: string | null
}

export const ExpenseField = memo(function ExpenseField({
  category,
  value,
  onChange,
  readOnly = false,
  error,
}: ExpenseFieldProps) {
  // Local state for input value (string)
  const [inputValue, setInputValue] = useState<string>(() =>
    value !== null && value !== undefined ? String(value) : ''
  )
  const [showTooltip, setShowTooltip] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input value when external value changes
  useEffect(() => {
    const newValue = value !== null && value !== undefined ? String(value) : ''
    if (newValue !== inputValue && document.activeElement !== inputRef.current) {
      setInputValue(newValue)
    }
  }, [value, inputValue])

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    // Allow empty input
    if (raw === '') {
      setInputValue('')
      onChange(null)
      return
    }

    // For currency fields, validate as decimal
    if (category.type === 'currency') {
      // Allow numbers with optional decimal point and up to 2 decimal places
      if (/^\d*\.?\d{0,2}$/.test(raw)) {
        setInputValue(raw)
        const num = parseFloat(raw)
        if (!isNaN(num)) {
          onChange(num)
        }
      }
      return
    }

    // For integer fields (mileage)
    if (category.type === 'integer') {
      if (/^\d*$/.test(raw)) {
        setInputValue(raw)
        const num = parseInt(raw, 10)
        if (!isNaN(num)) {
          onChange(num)
        }
      }
      return
    }

    // For text fields
    if (category.type === 'text') {
      setInputValue(raw)
      onChange(raw)
      return
    }

    // For date fields
    if (category.type === 'date') {
      setInputValue(raw)
      onChange(raw)
      return
    }
  }, [category.type, onChange])

  // Handle blur - format currency values
  const handleBlur = useCallback(() => {
    if (category.type === 'currency' && inputValue !== '') {
      const num = parseFloat(inputValue)
      if (!isNaN(num)) {
        setInputValue(num.toFixed(2))
      }
    }
  }, [category.type, inputValue])

  // Tooltip handlers with delay
  const showTooltipWithDelay = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, 200)
  }, [])

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    setShowTooltip(false)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [])

  // Toggle tooltip on click (mobile)
  const toggleTooltip = useCallback(() => {
    setShowTooltip(prev => !prev)
  }, [])

  return (
    <div className="relative">
      {/* Label with tooltip */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <label
          htmlFor={`expense-${category.field}`}
          className="text-sm font-medium text-foreground"
        >
          {category.label}
        </label>
        <button
          type="button"
          onClick={toggleTooltip}
          onMouseEnter={showTooltipWithDelay}
          onMouseLeave={hideTooltip}
          className="text-muted-foreground hover:text-primary transition-colors focus:outline-none focus:text-primary"
          aria-label={`Giải thích: ${category.label}`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Tooltip - z-[60] to overlay above form inputs (z-10) and sticky submit button (z-40) */}
        {showTooltip && (
          <div
            role="tooltip"
            className="absolute left-0 top-full mt-1 z-[60] w-64 p-3 bg-foreground text-background text-xs rounded-lg shadow-lg"
          >
            {category.tooltip}
            <div className="absolute -top-1 left-4 w-2 h-2 bg-foreground rotate-45" />
          </div>
        )}
      </div>

      {/* Input field */}
      <div className="relative">
        {category.type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
        )}

        {category.type === 'date' ? (
          <input
            ref={inputRef}
            id={`expense-${category.field}`}
            type="date"
            value={inputValue}
            onChange={handleChange}
            disabled={readOnly}
            className={cn(
              'w-full h-10 px-3 bg-card border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
              error ? 'border-error' : 'border-border'
            )}
          />
        ) : (
          <input
            ref={inputRef}
            id={`expense-${category.field}`}
            type="text"
            inputMode={category.type === 'currency' ? 'decimal' : category.type === 'integer' ? 'numeric' : 'text'}
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={category.placeholder}
            disabled={readOnly}
            min={0}
            className={cn(
              'w-full h-10 bg-card border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
              category.type === 'currency' ? 'pl-7 pr-3' : 'px-3',
              category.unit ? 'pr-12' : '',
              error ? 'border-error' : 'border-border'
            )}
          />
        )}

        {/* Unit suffix */}
        {category.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {category.unit}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

ExpenseField.displayName = 'ExpenseField'
