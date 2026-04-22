/**
 * ExtendLinkMenu - Dropdown with 7d/14d/30d/never options to extend a link.
 * Replaces the former ExtendLinkModal. Click-outside + Esc close; no backdrop modal.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Clock, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import type { ExtendDuration } from '../../hooks/use-shared-docs'

interface ExtendLinkMenuProps {
  onSelect: (duration: ExtendDuration) => void
  isLoading?: boolean
  align?: 'left' | 'right'
  variant?: 'subtle' | 'solid'
}

const DURATION_ORDER: ExtendDuration[] = ['7d', '14d', '30d', 'never']

export function ExtendLinkMenu({
  onSelect,
  isLoading = false,
  align = 'right',
  variant = 'subtle',
}: ExtendLinkMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (duration: ExtendDuration) => {
    setIsOpen(false)
    onSelect(duration)
  }

  const triggerClass =
    variant === 'solid'
      ? 'inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50'
      : 'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors disabled:opacity-50'

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => !isLoading && setIsOpen((v) => !v)}
        disabled={isLoading}
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        {t('sharedDocs.extendAction')}
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-[9999] mt-1 min-w-[180px] py-1 rounded-md border border-border bg-card shadow-lg',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {DURATION_ORDER.map((duration) => (
            <button
              key={duration}
              type="button"
              role="menuitem"
              disabled={isLoading}
              onClick={() => handleSelect(duration)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="text-foreground">
                {t(`sharedDocs.extend.${duration}`)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
