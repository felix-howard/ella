/**
 * Quick Actions Bar - Message composer with quick action buttons
 * Provides text input, template picker, and common actions
 * Includes dropdown for inserting various client links (portal, schedule E/C, draft return)
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Send, Link2, ChevronDown, Home, Briefcase, FileText, User } from 'lucide-react'
import { stripHtmlTags } from '../../lib/formatters'
import { api } from '../../lib/api-client'
import { useScheduleE } from '../../hooks/use-schedule-e'
import { useScheduleC } from '../../hooks/use-schedule-c'
import { useDraftReturn } from '../../hooks/use-draft-return'

// Build form URL from token
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173'

export interface QuickActionsBarProps {
  onSend: (message: string, channel: 'SMS' | 'PORTAL') => void
  isSending?: boolean
  disabled?: boolean
  clientName?: string
  clientPhone?: string
  clientId?: string
  caseId?: string
  defaultChannel?: 'SMS' | 'PORTAL'
  autoFocus?: boolean
}

export function QuickActionsBar({
  onSend,
  isSending,
  disabled,
  clientName,
  clientPhone: _clientPhone,
  clientId,
  caseId,
  defaultChannel: _defaultChannel = 'SMS',
  autoFocus,
}: QuickActionsBarProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [isLoadingPortalLink, setIsLoadingPortalLink] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch schedule E, C, and draft return data for link availability
  const { magicLink: scheduleELink } = useScheduleE({ caseId, enabled: !!caseId })
  const { magicLink: scheduleCLink } = useScheduleC({ caseId, enabled: !!caseId })
  const { magicLink: draftReturnLink } = useDraftReturn({ caseId, enabled: !!caseId })

  // Build URLs from tokens
  const scheduleEUrl = scheduleELink?.token ? `${PORTAL_URL}/rental/${scheduleELink.token}` : null
  const scheduleCUrl = scheduleCLink?.token ? `${PORTAL_URL}/expense/${scheduleCLink.token}` : null
  const draftReturnUrl = draftReturnLink?.url && draftReturnLink?.isActive ? draftReturnLink.url : null

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  }, [message])

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
  }, [autoFocus])

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!dropdownTriggerRef.current) return

    const rect = dropdownTriggerRef.current.getBoundingClientRect()
    const dropdownWidth = 220
    const viewportWidth = window.innerWidth

    // Position directly above the button with small gap
    let top = rect.top - 4
    let left = rect.left

    // Ensure it doesn't go off-screen to the left
    if (left < 8) left = 8
    // Ensure it doesn't go off-screen to the right
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8
    }

    setDropdownPosition({ top, left })
  }, [])

  // Update dropdown position when open
  useLayoutEffect(() => {
    if (isDropdownOpen) {
      updateDropdownPosition()
    }
  }, [isDropdownOpen, updateDropdownPosition])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node
      const clickedTrigger = dropdownTriggerRef.current?.contains(target)
      const clickedDropdown = dropdownRef.current?.contains(target)

      if (!clickedTrigger && !clickedDropdown) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Handle send - sanitize input before sending (always SMS)
  const handleSend = () => {
    const trimmed = stripHtmlTags(message).trim()
    if (!trimmed || isSending || disabled) return

    onSend(trimmed, 'SMS')
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // Insert a link into the message
  const insertLink = (url: string) => {
    setMessage((prev) => prev ? `${prev}\n${url}` : url)
    setIsDropdownOpen(false)
    textareaRef.current?.focus()
  }

  // Insert portal link into message
  const handleInsertPortalLink = async () => {
    if (!clientId || isLoadingPortalLink) return

    setIsLoadingPortalLink(true)
    try {
      const clientData = await api.clients.get(clientId)
      if (clientData.portalUrl) {
        insertLink(clientData.portalUrl)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get portal link:', error)
      }
    } finally {
      setIsLoadingPortalLink(false)
    }
  }

  // Check if any links are available (for showing dropdown vs single button)
  const hasAdditionalLinks = scheduleEUrl || scheduleCUrl || draftReturnUrl

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = message.trim().length > 0 && !isSending && !disabled

  // Dropdown content for link options
  const dropdownContent = isDropdownOpen && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        transform: 'translateY(-100%)',
        zIndex: 9999,
      }}
      className="w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
    >
      {/* Portal Link - always available */}
      <button
        onClick={handleInsertPortalLink}
        disabled={isLoadingPortalLink}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50"
      >
        <User className="w-4 h-4 text-muted-foreground" />
        {t('messages.linkPortal')}
        {isLoadingPortalLink && (
          <div className="ml-auto w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        )}
      </button>

      {/* Schedule E Link - only if available */}
      {scheduleEUrl && (
        <button
          onClick={() => insertLink(scheduleEUrl)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
        >
          <Home className="w-4 h-4 text-muted-foreground" />
          {t('messages.linkScheduleE')}
        </button>
      )}

      {/* Schedule C Link - only if available */}
      {scheduleCUrl && (
        <button
          onClick={() => insertLink(scheduleCUrl)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
        >
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          {t('messages.linkScheduleC')}
        </button>
      )}

      {/* Draft Return Link - only if available and active */}
      {draftReturnUrl && (
        <button
          onClick={() => insertLink(draftReturnUrl)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
        >
          <FileText className="w-4 h-4 text-muted-foreground" />
          {t('messages.linkDraftReturn')}
        </button>
      )}
    </div>,
    document.body
  )

  return (
    <div className="border-t border-border bg-card px-3 py-2">
        {/* Input area - vertically centered */}
        <div className="flex items-center gap-2">
          {/* Link dropdown button */}
          {clientId && (
            hasAdditionalLinks ? (
              // Dropdown button when additional links are available
              <button
                ref={dropdownTriggerRef}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isLoadingPortalLink}
                className={cn(
                  'p-2 rounded-lg transition-colors flex items-center gap-0.5',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isDropdownOpen && 'bg-muted text-foreground',
                  isLoadingPortalLink && 'opacity-50 cursor-wait'
                )}
                aria-label={t('messages.insertLink')}
                title={t('messages.insertLink')}
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                <Link2 className="w-[18px] h-[18px]" />
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              // Simple button when only portal link is available
              <button
                onClick={handleInsertPortalLink}
                disabled={isLoadingPortalLink}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isLoadingPortalLink && 'opacity-50 cursor-wait'
                )}
                aria-label={t('messages.insertPortalLink')}
                title={t('messages.insertPortalLink')}
              >
                {isLoadingPortalLink ? (
                  <div className="w-[18px] h-[18px] border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : (
                  <Link2 className="w-[18px] h-[18px]" />
                )}
              </button>
            )
          )}

          {/* Text input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('messages.inputPlaceholder')}
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full px-3 py-2 rounded-lg border border-border bg-muted',
                'resize-none overflow-hidden',
                'focus:outline-none focus:border-border',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'p-2 rounded-lg transition-colors',
              canSend
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            aria-label={t('messages.sendMessage')}
          >
            {isSending ? (
              <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>

        {/* Link dropdown portal */}
        {dropdownContent}
    </div>
  )
}
