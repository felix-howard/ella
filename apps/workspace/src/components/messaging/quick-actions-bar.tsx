/**
 * Quick Actions Bar - Message composer with quick action buttons
 * Provides text input, template picker, and common actions
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@ella/ui'
import { Send, Smile, FileText, Link2 } from 'lucide-react'
import { TemplatePicker, type MessageTemplate } from './template-picker'
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
}

export function QuickActionsBar({
  onSend,
  isSending,
  disabled,
  clientName,
  clientPhone,
  clientId,
  defaultChannel = 'SMS',
}: QuickActionsBarProps) {
  const [message, setMessage] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
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

  // Handle template selection
  const handleTemplateSelect = (template: MessageTemplate) => {
    setMessage(template.content)
    textareaRef.current?.focus()
  }

  const canSend = message.trim().length > 0 && !isSending && !disabled

  return (
    <>
      <div className="border-t border-border bg-card px-4 py-3">
        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* Quick action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTemplates(true)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-label="Chọn mẫu tin nhắn"
              title="Mẫu tin nhắn"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                // TODO: Implement emoji picker
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-label="Thêm emoji"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {clientId && (
              <button
                onClick={handleInsertPortalLink}
                disabled={isLoadingPortalLink}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isLoadingPortalLink && 'opacity-50 cursor-wait'
                )}
                aria-label="Chèn link portal"
                title="Chèn link portal"
              >
                {isLoadingPortalLink ? (
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : (
                  <Link2 className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl border border-border bg-muted',
                'resize-none overflow-hidden',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
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
              'p-3 rounded-xl transition-colors',
              canSend
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            aria-label="Gửi tin nhắn"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Template picker modal */}
      <TemplatePicker
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
        clientName={clientName}
      />
    </>
  )
}
