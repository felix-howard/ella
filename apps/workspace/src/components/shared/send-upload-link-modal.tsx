/**
 * SendUploadLinkModal - Modal for customizing SMS message before sending upload link
 * Shows editable message template with VN/EN toggle and placeholder guide
 */
import { useState } from 'react'
import { X, Send, Loader2, Info, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import { cn } from '@ella/ui'
import type { Language } from '../../lib/api-client'

interface SendUploadLinkModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string) => void
  isSending: boolean
  clientName: string
  taxYear: number
}

export const UPLOAD_LINK_TEMPLATE_VI = `Xin chào {{client_name}}, để chuẩn bị hồ sơ thuế năm {{tax_year}}, vui lòng gửi 1040 của khai thuế năm trước, copy of ID, social, thu nhập W2/1099, bảo hiểm 1095A và các tài liệu cần thiết qua link: {{portal_link}}`
export const UPLOAD_LINK_TEMPLATE_EN = `Hello {{client_name}}, to prepare your {{tax_year}} tax return, please upload your prior year 1040, copy of ID, social, W2/1099 income, 1095A insurance, and other required documents via the link: {{portal_link}}`

export function SendUploadLinkModal({
  isOpen,
  onClose,
  onSend,
  isSending,
  clientName,
  taxYear,
}: SendUploadLinkModalProps) {
  const { t } = useTranslation()

  const [language, setLanguage] = useState<Language>('VI')
  const [messages, setMessages] = useState({
    VI: UPLOAD_LINK_TEMPLATE_VI,
    EN: UPLOAD_LINK_TEMPLATE_EN,
  })

  // Reset when modal opens (adjust state during render pattern)
  const [prevIsOpen, setPrevIsOpen] = useState(false)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setMessages({
        VI: UPLOAD_LINK_TEMPLATE_VI,
        EN: UPLOAD_LINK_TEMPLATE_EN,
      })
      setLanguage('VI')
    }
  }

  const currentMessage = messages[language]

  const handleMessageChange = (value: string) => {
    setMessages((prev) => ({ ...prev, [language]: value }))
  }

  if (!isOpen) return null

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
            <h2 className="text-lg font-semibold text-foreground">{t('sendUploadLinkModal.title')}</h2>
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
              rows={5}
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
                  <li><code className="bg-muted px-1 rounded">{'{{client_name}}'}</code> → {clientName}</li>
                  <li><code className="bg-muted px-1 rounded">{'{{tax_year}}'}</code> → {taxYear}</li>
                  <li><code className="bg-muted px-1 rounded">{'{{portal_link}}'}</code> → {t('sendFormModal.autoGenerated')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={() => onSend(currentMessage)}
            disabled={isSending || !currentMessage.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('sendFormModal.sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t('sendUploadLinkModal.sendButton')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
