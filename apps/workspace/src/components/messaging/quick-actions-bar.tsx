/**
 * Quick Actions Bar - Message composer with quick action buttons
 * Provides text input, template picker, and common actions
 * Includes dropdown for inserting various client links (portal, schedule E/C, shared docs)
 */

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Send, Link2, ChevronDown, Home, Briefcase, FileText, User, ImagePlus } from 'lucide-react'
import { stripHtmlTags } from '../../lib/formatters'
import { api } from '../../lib/api-client'
import {
  ALLOWED_MESSAGE_IMAGE_TYPES,
  MAX_MESSAGE_IMAGE_COUNT,
  validateMessageAttachments,
  type MessageAttachmentValidationError,
} from '../../lib/message-attachment-validation'
import { useScheduleE } from '../../hooks/use-schedule-e'
import { useScheduleC } from '../../hooks/use-schedule-c'
import { useSharedDocs } from '../../hooks/use-shared-docs'
import type { ChatContext } from '../../types/chat-context'
import { getQuickTemplates } from '../../lib/chat-quick-templates'
import { ChatTemplateDropdown } from './chat-template-dropdown'
import { AttachmentPreviewStrip, type ComposerAttachment } from './attachment-preview-strip'

const ACCEPTED_MESSAGE_IMAGE_TYPES = ALLOWED_MESSAGE_IMAGE_TYPES.join(',')

export interface QuickActionsBarProps {
  onSend: (message: string, channel: 'SMS' | 'PORTAL', attachments?: File[]) => void | Promise<void>
  isSending?: boolean
  disabled?: boolean
  clientName?: string
  clientPhone?: string
  clientId?: string
  caseId?: string
  defaultChannel?: 'SMS' | 'PORTAL'
  autoFocus?: boolean
  /**
   * Optional chat context. When `type === 'lead'`, the case-specific link
   * dropdown is replaced by lead templates (NDA link, follow-up).
   * Absent → behaves identically to legacy case-only callers.
   */
  context?: ChatContext
}

export function QuickActionsBar({
  onSend,
  isSending,
  disabled,
  clientName: _clientName,
  clientPhone: _clientPhone,
  clientId,
  caseId,
  defaultChannel: _defaultChannel = 'SMS',
  autoFocus,
  context,
}: QuickActionsBarProps) {
  const isLeadContext = context?.type === 'lead'
  const leadTemplates = isLeadContext ? getQuickTemplates(context) : []
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [isLoadingPortalLink, setIsLoadingPortalLink] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentsRef = useRef<ComposerAttachment[]>([])
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch schedule E, C, and shared docs data for link availability
  const { magicLink: scheduleELink } = useScheduleE({ caseId, enabled: !!caseId })
  const { magicLink: scheduleCLink } = useScheduleC({ caseId, enabled: !!caseId })
  const { documents: sharedDocs } = useSharedDocs({ caseId, enabled: !!caseId })

  // Get URLs from API responses (URL is built server-side with correct PORTAL_URL)
  const scheduleEUrl = scheduleELink?.url && scheduleELink?.isActive ? scheduleELink.url : null
  const scheduleCUrl = scheduleCLink?.url && scheduleCLink?.isActive ? scheduleCLink.url : null
  const sharedDocLinks = sharedDocs
    .filter((doc) => doc.magicLink?.url && doc.magicLink?.isActive)
    .map((doc) => ({ id: doc.id, title: doc.title, url: doc.magicLink!.url }))

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

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl))
    }
  }, [])

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!dropdownTriggerRef.current) return

    const rect = dropdownTriggerRef.current.getBoundingClientRect()
    const dropdownWidth = 220
    const viewportWidth = window.innerWidth

    // Position directly above the button with small gap
    const top = rect.top - 4
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

  const getAttachmentErrorMessage = useCallback((error: MessageAttachmentValidationError) => {
    const keyByError: Record<MessageAttachmentValidationError, string> = {
      too_many: 'messages.attachmentLimit',
      unsupported_type: 'messages.attachmentUnsupportedType',
      too_large: 'messages.attachmentTooLarge',
      empty_file: 'messages.attachmentEmptyFile',
    }
    return t(keyByError[error])
  }, [t])

  const addAttachments = useCallback((files: File[]) => {
    if (files.length === 0) return

    const nextFiles = [...attachmentsRef.current.map((attachment) => attachment.file), ...files]
    const validation = validateMessageAttachments(nextFiles)
    if (!validation.ok && validation.error) {
      setAttachmentError(getAttachmentErrorMessage(validation.error))
      return
    }

    setAttachmentError(null)
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }, [getAttachmentErrorMessage])

  const clearAttachments = useCallback(() => {
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl))
      return []
    })
    setAttachmentError(null)
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id)
      if (attachment) URL.revokeObjectURL(attachment.previewUrl)
      return current.filter((item) => item.id !== id)
    })
    setAttachmentError(null)
  }, [])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addAttachments(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (isLeadContext || disabled || isSending) return

    const pastedFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file && file.type.startsWith('image/'))

    if (pastedFiles.length === 0) return
    event.preventDefault()
    addAttachments(pastedFiles)
  }

  // Handle send - sanitize input before sending (always SMS)
  const handleSend = async () => {
    const trimmed = stripHtmlTags(message).trim()
    if ((!trimmed && attachments.length === 0) || isSending || disabled) return

    const previousMessage = message
    const attachmentFiles = attachments.map((attachment) => attachment.file)

    setMessage('')
    clearAttachments()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await onSend(trimmed, 'SMS', attachmentFiles)
    } catch {
      setMessage(previousMessage)
      setAttachments(() =>
        attachmentFiles.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }))
      )
      return
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
  const hasAdditionalLinks = scheduleEUrl || scheduleCUrl || sharedDocLinks.length > 0

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canAttachImages = !isLeadContext
  const canSend = (message.trim().length > 0 || attachments.length > 0) && !isSending && !disabled

  // Insert text from a chat template into the composer.
  const handleTemplateInsert = (text: string) => {
    setMessage((prev) => prev ? `${prev}\n${text}` : text)
    textareaRef.current?.focus()
  }

  // Case context: link dropdown (portal + schedule E/C + shared docs).
  const caseDropdown = !isLeadContext && isDropdownOpen && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        transform: 'translateY(-100%)',
        zIndex: 9999,
      }}
      className="w-56 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Portal Link - always available */}
      <button
        onClick={handleInsertPortalLink}
        disabled={isLoadingPortalLink}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50"
      >
        <User className="w-4 h-4 text-muted-foreground" />
        {t('messages.linkUpload')}
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

      {/* Shared Doc Links - one entry per active section */}
      {sharedDocLinks.map((doc) => (
        <button
          key={doc.id}
          onClick={() => insertLink(doc.url)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
        >
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="truncate">{doc.title}</span>
        </button>
      ))}
    </div>,
    document.body
  )

  const dropdownContent = caseDropdown

  return (
    <div className="bg-card px-3 py-2.5 shadow-[0_-1px_4px_-1px_rgba(0,0,0,0.04)]">
        <AttachmentPreviewStrip
          attachments={attachments}
          error={attachmentError}
          removeLabel={t('messages.removeAttachment')}
          selectedLabel={t('messages.attachmentSelectedCount', { count: attachments.length })}
          onRemove={removeAttachment}
        />

        {/* Input area - vertically centered */}
        <div className="flex items-center gap-2">
          {/* Lead context: templates dropdown */}
          {isLeadContext && (
            <ChatTemplateDropdown
              templates={leadTemplates}
              onInsert={handleTemplateInsert}
            />
          )}

          {canAttachImages && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MESSAGE_IMAGE_TYPES}
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isSending || attachments.length >= MAX_MESSAGE_IMAGE_COUNT}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                  (disabled || isSending || attachments.length >= MAX_MESSAGE_IMAGE_COUNT) && 'opacity-50 cursor-not-allowed'
                )}
                aria-label={t('messages.attachImage')}
                title={t('messages.attachImage')}
              >
                <ImagePlus className="w-[18px] h-[18px]" />
              </button>
            </>
          )}

          {/* Case context: link dropdown button */}
          {!isLeadContext && clientId && (
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
              onPaste={handlePaste}
              placeholder={t('messages.inputPlaceholder')}
              disabled={disabled || isSending}
              rows={1}
              className={cn(
                'w-full px-3.5 py-2 rounded-xl bg-muted/50 border border-transparent',
                'resize-none overflow-hidden',
                'focus:outline-none focus:bg-muted/70 focus:border-border/40',
                'text-base md:text-sm text-foreground placeholder:text-muted-foreground/60',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'p-2 rounded-xl transition-all duration-200',
              canSend
                ? 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-md'
                : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
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
