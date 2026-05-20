import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'

export type UploadLinkExtendDays = 7 | 14 | 30 | 60

interface UploadLinkExtendMenuProps {
  onSelect: (days: UploadLinkExtendDays) => void
  isLoading?: boolean
}

const EXTEND_OPTIONS: UploadLinkExtendDays[] = [7, 14, 30, 60]

export function UploadLinkExtendMenu({ onSelect, isLoading = false }: UploadLinkExtendMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => !isLoading && setIsOpen((open) => !open)}
        disabled={isLoading}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
        {t('uploadLinks.extend')}
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[150px] rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {EXTEND_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              role="menuitem"
              disabled={isLoading}
              onClick={() => {
                setIsOpen(false)
                onSelect(days)
              }}
              className="flex w-full items-center px-3 py-2 text-left text-xs text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              {t('uploadLinks.extendDays', { days })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
