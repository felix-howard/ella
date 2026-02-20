/**
 * SendFormMessageModal - Reusable modal for customizing SMS message before sending forms
 * Used by Schedule C and Schedule E to allow editing the message template before sending
 */
import { useState, useEffect } from 'react'
import { X, Send, Loader2, Info, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import { cn } from '@ella/ui'
import type { Language } from '../../lib/api-client'

interface SendFormMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string) => void
  isSending: boolean
  formType: 'scheduleC' | 'scheduleE'
  clientName: string
  defaultTemplateVI: string
  defaultTemplateEN: string
}

// Available placeholders for form messages
const PLACEHOLDERS = {
  client_name: '{{client_name}}',
  form_link: '{{form_link}}',
}

// Replace placeholders with actual/preview values
function renderPreview(template: string, clientName: string): string {
  return template
    .replace(/\{\{client_name\}\}/g, clientName)
    .replace(/\{\{form_link\}\}/g, '[Form Link]')
}

export function SendFormMessageModal({
  isOpen,
  onClose,
  onSend,
  isSending,
  formType,
  clientName,
  defaultTemplateVI,
  defaultTemplateEN,
}: SendFormMessageModalProps) {
  const { t } = useTranslation()

  // Language state for message template
  const [language, setLanguage] = useState<Language>('VI')

  // Custom messages per language
  const [messages, setMessages] = useState({
    VI: defaultTemplateVI,
    EN: defaultTemplateEN,
  })

  // Reset to defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessages({
        VI: defaultTemplateVI,
        EN: defaultTemplateEN,
      })
      setLanguage('VI')
    }
  }, [isOpen, defaultTemplateVI, defaultTemplateEN])

  const currentMessage = messages[language]
  const preview = renderPreview(currentMessage, clientName)

  const handleMessageChange = (value: string) => {
    setMessages((prev) => ({
      ...prev,
      [language]: value,
    }))
  }

  const handleSend = () => {
    onSend(currentMessage)
  }

  if (!isOpen) return null

  const titleKey = formType === 'scheduleC' ? 'sendFormModal.titleScheduleC' : 'sendFormModal.titleScheduleE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t(titleKey)}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Language Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t('sendFormModal.messageLanguage')}</span>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setLanguage('VI')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  language === 'VI'
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                VN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  language === 'EN'
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                EN
              </button>
            </div>
          </div>

          {/* Editable Message */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('sendFormModal.messageTemplate')}
            </label>
            <textarea
              value={currentMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              rows={4}
              disabled={isSending}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-background text-sm text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'placeholder:text-muted-foreground resize-none border-border',
                isSending && 'opacity-50 cursor-not-allowed'
              )}
              placeholder={t('sendFormModal.messagePlaceholder')}
            />
          </div>

          {/* Placeholder Guide */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">{t('sendFormModal.placeholderGuide')}</p>
                <ul className="space-y-0.5 ml-2">
                  <li><code className="bg-muted px-1 rounded">{PLACEHOLDERS.client_name}</code> → {clientName}</li>
                  <li><code className="bg-muted px-1 rounded">{PLACEHOLDERS.form_link}</code> → {t('sendFormModal.autoGenerated')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('sendFormModal.preview')}</p>
            <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground border border-border">
              {preview}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !currentMessage.trim()}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('sendFormModal.sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t('sendFormModal.sendButton')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Default templates for Schedule C
export const SCHEDULE_C_TEMPLATE_VI = `Xin chào {{client_name}}, vui lòng điền thông tin chi phí kinh doanh qua link: {{form_link}}`
export const SCHEDULE_C_TEMPLATE_EN = `Hello {{client_name}}, please fill in your business expenses via the link: {{form_link}}`

// Default templates for Schedule E
export const SCHEDULE_E_TEMPLATE_VI = `Xin chào {{client_name}}, vui lòng điền thông tin nhà cho thuê qua link: {{form_link}}`
export const SCHEDULE_E_TEMPLATE_EN = `Hello {{client_name}}, please fill in your rental property information via the link: {{form_link}}`
