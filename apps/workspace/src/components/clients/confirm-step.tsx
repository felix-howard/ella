/**
 * ConfirmStep - Final step in simplified client creation
 * Shows summary of client info and editable SMS preview before creating
 * Part of Phase 1: Simplify Client Workflow
 */

import { MessageSquare, Loader2, Send, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { ClientConfirmSummary } from './client-confirm-summary'
import { ClientSmsTemplateSelector } from './client-sms-template-selector'
import {
  DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  ensurePortalLinkPlaceholder,
  getClientSmsTemplate,
  hasPortalLinkPlaceholder,
  type ClientSmsLanguage,
  type ClientSmsTemplateId,
} from './client-sms-templates'

interface ConfirmStepProps {
  clientName: string
  phone: string
  taxYear: number
  language: ClientSmsLanguage
  onLanguageChange: (language: ClientSmsLanguage) => void
  onSubmit: () => void
  isSubmitting: boolean
  customMessage?: string
  onMessageChange?: (message: string) => void
  selectedTemplateId?: ClientSmsTemplateId
  onTemplateSelect?: (templateId: ClientSmsTemplateId) => void
}

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
  selectedTemplateId = DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  onTemplateSelect,
}: ConfirmStepProps) {
  const { t } = useTranslation()

  // Get the default template based on language
  const defaultTemplate = getClientSmsTemplate(DEFAULT_CLIENT_SMS_TEMPLATE_ID, language)

  // Use custom message if provided, otherwise use default
  const messageTemplate = customMessage ?? defaultTemplate
  const portalLinkIncluded = hasPortalLinkPlaceholder(messageTemplate)

  // Preview with actual values
  const smsPreview = renderMessage(ensurePortalLinkPlaceholder(messageTemplate), clientName, taxYear)

  return (
    <div className="space-y-6">
      <ClientConfirmSummary clientName={clientName} phone={phone} taxYear={taxYear} />

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

        {onMessageChange && (
          <ClientSmsTemplateSelector
            language={language}
            selectedTemplateId={selectedTemplateId}
            onSelect={(templateId, message) => {
              onTemplateSelect?.(templateId)
              onMessageChange(message)
            }}
          />
        )}

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
              {!portalLinkIncluded && (
                <p className="text-primary font-medium">{t('confirmStep.portalLinkNote')}</p>
              )}
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
