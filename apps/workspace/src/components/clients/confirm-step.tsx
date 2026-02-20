/**
 * ConfirmStep - Final step in simplified client creation
 * Shows summary of client info and editable SMS preview before creating
 * Part of Phase 1: Simplify Client Workflow
 */

import { MessageSquare, Loader2, User, Phone, Calendar, Send, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { formatPhone } from '../../lib/formatters'

interface ConfirmStepProps {
  clientName: string
  phone: string
  taxYear: number
  language: 'VI' | 'EN'
  onLanguageChange: (language: 'VI' | 'EN') => void
  onSubmit: () => void
  isSubmitting: boolean
  customMessage?: string
  onMessageChange?: (message: string) => void
}

// Default SMS message templates with placeholders
export const DEFAULT_SMS_TEMPLATE_VI = `Xin chào {{client_name}}, để chuẩn bị hồ sơ thuế năm {{tax_year}}, vui lòng gửi các tài liệu cần thiết qua link: {{portal_link}}`

export const DEFAULT_SMS_TEMPLATE_EN = `Hello {{client_name}}, to prepare your {{tax_year}} tax documents, please send the required documents via the link: {{portal_link}}`

// Replace placeholders with actual values for preview
function renderMessage(template: string, name: string, year: number): string {
  return template
    .replace(/\{\{client_name\}\}/g, name)
    .replace(/\{\{tax_year\}\}/g, String(year))
    .replace(/\{\{portal_link\}\}/g, '[Portal Link]')
}

export function ConfirmStep({
  clientName,
  phone,
  taxYear,
  language,
  onLanguageChange,
  onSubmit,
  isSubmitting,
  customMessage,
  onMessageChange,
}: ConfirmStepProps) {
  const { t } = useTranslation()

  // Get the default template based on language
  const defaultTemplate = language === 'VI' ? DEFAULT_SMS_TEMPLATE_VI : DEFAULT_SMS_TEMPLATE_EN

  // Use custom message if provided, otherwise use default
  const messageTemplate = customMessage ?? defaultTemplate

  // Preview with actual values
  const smsPreview = renderMessage(messageTemplate, clientName, taxYear)

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">{t('confirmStep.title')}</h3>
        <dl className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              {t('confirmStep.name')}
            </dt>
            <dd className="font-medium text-foreground">{clientName}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              {t('confirmStep.phone')}
            </dt>
            <dd className="font-medium text-foreground">{formatPhone(phone)}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {t('confirmStep.taxYear')}
            </dt>
            <dd className="font-medium text-foreground">{taxYear}</dd>
          </div>
        </dl>
      </div>

      {/* SMS Preview & Editor */}
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('confirmStep.messagePreview')}</span>
          </div>
          {/* Language Toggle */}
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
            <button
              type="button"
              onClick={() => onLanguageChange('VI')}
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
              onClick={() => onLanguageChange('EN')}
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

        {/* Editable Message Template */}
        {onMessageChange ? (
          <textarea
            value={messageTemplate}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border bg-card text-sm text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'placeholder:text-muted-foreground resize-none border-border'
            )}
            placeholder={t('confirmStep.messagePlaceholder')}
          />
        ) : (
          <div className="bg-card rounded-lg p-3 text-sm text-muted-foreground border border-border shadow-sm">
            {smsPreview}
          </div>
        )}

        {/* Placeholder Guide */}
        <div className="mt-3 p-3 bg-card/50 rounded-lg border border-border/50">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">{t('confirmStep.placeholderGuide')}</p>
              <ul className="space-y-0.5 ml-2">
                <li><code className="bg-muted px-1 rounded">{'{{client_name}}'}</code> → {clientName}</li>
                <li><code className="bg-muted px-1 rounded">{'{{tax_year}}'}</code> → {taxYear}</li>
                <li><code className="bg-muted px-1 rounded">{'{{portal_link}}'}</code> → {t('confirmStep.autoGenerated')}</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium',
          'bg-primary text-white transition-colors',
          isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('confirmStep.creating')}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {t('confirmStep.submit')}
          </>
        )}
      </button>

      {/* Info note */}
      <p className="text-xs text-muted-foreground text-center">
        {t('confirmStep.infoNote')}
      </p>
    </div>
  )
}
