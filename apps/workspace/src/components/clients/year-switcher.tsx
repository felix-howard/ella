/**
 * YearSwitcher - Interactive dropdown for switching between engagement years
 * Shows all years with status badges, allows switching and creating new
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Calendar, Plus, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import type { TaxEngagement } from '../../lib/api-client'

interface YearSwitcherProps {
  engagements: TaxEngagement[]
  selectedYear: number
  onYearChange: (year: number, engagementId: string) => void
  onCreateNew: () => void
}

export function YearSwitcher({
  engagements,
  selectedYear,
  onYearChange,
  onCreateNew,
}: YearSwitcherProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    // Early return if not open - prevents adding unnecessary listeners
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Sort engagements by year descending (most recent first)
  const sortedEngagements = [...engagements].sort((a, b) => b.taxYear - a.taxYear)

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
          'hover:bg-muted focus:outline-none',
          'border-border'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Năm thuế: ${selectedYear}`}
      >
        <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="font-medium">{selectedYear}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1"
          role="listbox"
          aria-label="Chọn năm thuế"
        >
          {/* Year Options */}
          {sortedEngagements.map((engagement) => (
            <button
              key={engagement.id}
              role="option"
              aria-selected={engagement.taxYear === selectedYear}
              onClick={() => {
                onYearChange(engagement.taxYear, engagement.id)
                setIsOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors',
                engagement.taxYear === selectedYear && 'bg-primary-light/30'
              )}
            >
              <span className="font-medium">{engagement.taxYear}</span>
              {engagement.taxYear === selectedYear && (
                <Check className="w-4 h-4 text-primary" aria-hidden="true" />
              )}
            </button>
          ))}

          {/* Divider */}
          {sortedEngagements.length > 0 && <div className="border-t border-border my-1" />}

          {/* Create New */}
          <button
            onClick={() => {
              onCreateNew()
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary-light/30 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('yearSwitcher.addNewYear')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
