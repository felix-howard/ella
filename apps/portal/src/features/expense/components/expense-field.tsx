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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="flex items-center gap-1.5 mb-2">
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
          className="text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none focus:text-primary"
          aria-label={category.label}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Tooltip - z-[60] to overlay above form inputs (z-10) and sticky submit button (z-40) */}
        {showTooltip && (
          <div
            role="tooltip"
            className="absolute left-0 top-full mt-1 z-[60] w-64 p-3 bg-foreground text-background text-xs rounded-xl shadow-lg"
          >
            {category.tooltip}
            <div className="absolute -top-1 left-4 w-2 h-2 bg-foreground rotate-45" />
          </div>
        )}
      </div>

      {/* Description text */}
      {category.description && (
        <p className="text-xs text-muted-foreground mb-2 -mt-0.5">
          {category.description}
        </p>
      )}

      {/* Input field */}
      <div className="relative">
        {category.type === 'currency' && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-sm font-medium">
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
              'w-full h-11 px-3.5 bg-card rounded-xl text-sm shadow-sm',
              'border border-border/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
              'transition-all duration-200',
              error ? 'border-error/60 shadow-error/5' : ''
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
              'w-full h-11 bg-card rounded-xl text-sm shadow-sm',
              'border border-border/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
              'transition-all duration-200',
              'placeholder:text-muted-foreground/50',
              category.type === 'currency' ? 'pl-8 pr-3.5' : 'px-3.5',
              category.unit ? 'pr-14' : '',
              error ? 'border-error/60 shadow-error/5' : ''
            )}
          />
        )}

        {/* Unit suffix */}
        {category.unit && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium">
            {category.unit}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

ExpenseField.displayName = 'ExpenseField'
