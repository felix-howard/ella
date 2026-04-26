/**
 * Chat template dropdown — lightweight dropdown for lead-context templates
 * (e.g., "Send NDA link", "Schedule follow-up"). Rendered through a portal
 * so it stays positioned relative to the trigger even inside overflow:hidden.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FileText, Calendar, Link2 } from 'lucide-react'
import { cn } from '@ella/ui'
import type { QuickTemplate, QuickTemplateIcon } from '../../lib/chat-quick-templates'

const TEMPLATE_ICONS: Record<QuickTemplateIcon, typeof FileText> = {
  'file-text': FileText,
  calendar: Calendar,
  link: Link2,
}

export interface ChatTemplateDropdownProps {
  templates: QuickTemplate[]
  onInsert: (text: string) => void
}

export function ChatTemplateDropdown({ templates, onInsert }: ChatTemplateDropdownProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Position menu above trigger, clamped to viewport.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 220
    const viewport = window.innerWidth
    let left = rect.left
    if (left < 8) left = 8
    if (left + menuWidth > viewport - 8) left = viewport - menuWidth - 8
    setPosition({ top: rect.top - 4, left })
  }, [isOpen])

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  if (templates.length === 0) return null

  const menu = isOpen && createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)',
        zIndex: 9999,
      }}
      className="w-56 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden"
    >
      {templates.map((tpl) => {
        const Icon = TEMPLATE_ICONS[tpl.icon] ?? FileText
        return (
          <button
            key={tpl.key}
            onClick={() => {
              if (tpl.text) onInsert(tpl.text)
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{t(tpl.labelKey, { defaultValue: tpl.key })}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'p-2 rounded-lg transition-colors flex items-center gap-0.5',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          isOpen && 'bg-muted text-foreground'
        )}
        aria-label={t('chat.templates.open', { defaultValue: 'Insert template' })}
        title={t('chat.templates.open', { defaultValue: 'Insert template' })}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Link2 className="w-[18px] h-[18px]" />
        <ChevronDown className="w-3 h-3" />
      </button>
      {menu}
    </>
  )
}
