/**
 * Quick Actions Bar - Message composer with quick action buttons
 * Provides text input, template picker, and common actions
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Send, Link2 } from 'lucide-react'
import { stripHtmlTags } from '../../lib/formatters'
import { api } from '../../lib/api-client'

export interface QuickActionsBarProps {
  onSend: (message: string, channel: 'SMS' | 'PORTAL') => void
  isSending?: boolean
  disabled?: boolean
  clientName?: string
  clientPhone?: string
  clientId?: string
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
  defaultChannel: _defaultChannel = 'SMS',
  autoFocus,
}: QuickActionsBarProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [isLoadingPortalLink, setIsLoadingPortalLink] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Insert portal link into message
  const handleInsertPortalLink = async () => {
    if (!clientId || isLoadingPortalLink) return

    setIsLoadingPortalLink(true)
    try {
      const clientData = await api.clients.get(clientId)
      if (clientData.portalUrl) {
        const portalUrl = clientData.portalUrl
        setMessage((prev) => prev ? `${prev}\n${portalUrl}` : portalUrl)
        textareaRef.current?.focus()
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get portal link:', error)
      }
    } finally {
      setIsLoadingPortalLink(false)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = message.trim().length > 0 && !isSending && !disabled

  return (
    <div className="border-t border-border bg-card px-3 py-2">
        {/* Input area - vertically centered */}
        <div className="flex items-center gap-2">
          {/* Quick action buttons */}
          {clientId && (
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
    </div>
  )
}
