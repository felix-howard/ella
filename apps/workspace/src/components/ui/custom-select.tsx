/**
 * CustomSelect - Dark mode compatible dropdown component
 * Uses a custom dropdown instead of native select for consistent styling
 */

import { useState, useRef, useEffect } from 'react'
import { cn } from '@ella/ui'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: boolean
  disabled?: boolean
  className?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  error = false,
  disabled = false,
  className,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground text-left',
          'flex items-center justify-between',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'transition-colors',
          error ? 'border-error' : 'border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn(!selectedOption && 'text-muted-foreground')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown menu - uses fixed positioning to escape overflow:hidden parents */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-[9999] w-full mt-1 py-1 rounded-lg border',
            'bg-card border-border shadow-lg',
            'max-h-60 overflow-auto'
          )}
          style={{ position: 'absolute' }}
        >
          {/* Placeholder option */}
          <button
            type="button"
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
            className={cn(
              'w-full px-3 py-2 text-left text-sm',
              'hover:bg-muted transition-colors',
              'text-muted-foreground'
            )}
          >
            {placeholder}
          </button>

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm',
                'hover:bg-muted transition-colors',
                'flex items-center justify-between',
                'text-foreground',
                value === option.value && 'bg-primary text-white'
              )}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
