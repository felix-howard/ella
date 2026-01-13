/**
 * Quick Actions Bar - Message composer with quick action buttons
 * Provides text input, template picker, and common actions
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@ella/ui'
import { Send, Smile, FileText, Phone, ImageIcon } from 'lucide-react'
import { TemplatePicker, type MessageTemplate } from './template-picker'
import { stripHtmlTags } from '../../lib/formatters'

export interface QuickActionsBarProps {
  onSend: (message: string, channel: 'SMS' | 'PORTAL') => void
  isSending?: boolean
  disabled?: boolean
  clientName?: string
  clientPhone?: string
  defaultChannel?: 'SMS' | 'PORTAL'
}

export function QuickActionsBar({
  onSend,
  isSending,
  disabled,
  clientName,
  clientPhone,
  defaultChannel = 'SMS',
}: QuickActionsBarProps) {
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<'SMS' | 'PORTAL'>(defaultChannel)
  const [showTemplates, setShowTemplates] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  }, [message])

  // Handle send - sanitize input before sending
  const handleSend = () => {
    const trimmed = stripHtmlTags(message).trim()
    if (!trimmed || isSending || disabled) return

    onSend(trimmed, channel)
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
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
        {/* Channel selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">Gửi qua:</span>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setChannel('SMS')}
              disabled={!clientPhone}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                channel === 'SMS'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground',
                !clientPhone && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Phone className="w-3 h-3" />
              SMS
            </button>
            <button
              onClick={() => setChannel('PORTAL')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                channel === 'PORTAL'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ImageIcon className="w-3 h-3" />
              Portal
            </button>
          </div>
          {channel === 'SMS' && clientPhone && (
            <span className="text-xs text-muted-foreground ml-2">
              → {clientPhone}
            </span>
          )}
        </div>

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
                'w-full px-4 py-2.5 rounded-xl border border-border bg-background',
                'resize-none overflow-hidden',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                'text-sm placeholder:text-muted-foreground',
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

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground mt-2 text-right">
          Enter để gửi • Shift+Enter xuống dòng
        </p>
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
