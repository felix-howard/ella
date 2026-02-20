/**
 * StateCombobox - Searchable dropdown for US states
 * Full state names, keyboard navigation, accessibility
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@ella/ui'
import { US_STATES } from '../lib/rental-constants'

interface StateComboboxProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  error?: boolean
}

export function StateCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select state',
  id,
  error = false,
}: StateComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [highlightIndex, setHighlightIndex] = useState(0)

  // Get selected state label
  const selectedState = US_STATES.find((s) => s.value === value)
  const displayValue = selectedState ? `${selectedState.label} (${selectedState.value})` : ''

  // Filter states by search
  const filteredStates = useMemo(() => {
    if (!search.trim()) return US_STATES
    const q = search.toLowerCase()
    return US_STATES.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.value.toLowerCase().includes(q)
    )
  }, [search])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0)
  }, [filteredStates.length])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle select
  const handleSelect = useCallback((stateValue: string) => {
    onChange(stateValue)
    setIsOpen(false)
    setSearch('')
  }, [onChange])

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((prev) => Math.min(prev + 1, filteredStates.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredStates[highlightIndex]) {
          handleSelect(filteredStates[highlightIndex].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearch('')
        break
    }
  }, [isOpen, filteredStates, highlightIndex, handleSelect])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightIndex, isOpen])

  // Focus input when open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'w-full h-10 px-3 bg-card border rounded-lg text-sm text-left',
          'flex items-center justify-between gap-2',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          !value && 'text-muted-foreground',
          error ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : 'border-border'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex-1">
          {displayValue || placeholder}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search state..."
                className={cn(
                  'w-full h-9 pl-8 pr-3 bg-background border border-border rounded-md text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
                )}
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filteredStates.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                No states found
              </li>
            ) : (
              filteredStates.map((state, index) => (
                <li
                  key={state.value}
                  role="option"
                  aria-selected={state.value === value}
                  onClick={() => handleSelect(state.value)}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2',
                    'hover:bg-muted/50',
                    index === highlightIndex && 'bg-muted/50',
                    state.value === value && 'text-primary font-medium'
                  )}
                >
                  <span>
                    {state.label} <span className="text-muted-foreground">({state.value})</span>
                  </span>
                  {state.value === value && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
