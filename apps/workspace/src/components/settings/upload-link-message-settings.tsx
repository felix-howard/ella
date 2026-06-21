import { MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Switch, cn } from '@ella/ui'
import type { Language, UploadLinkTemplateId } from '../../lib/api-client'
import { ClientSmsTemplateSelector } from '../clients/client-sms-template-selector'
import { resolveClientSmsTemplateId } from '../clients/client-sms-templates'

interface UploadLinkMessageSettingsProps {
  autoSend: boolean
  language: Language
  templateId: UploadLinkTemplateId | null
  disabled?: boolean
  allowDefaultTemplate?: boolean
  name: string
  onAutoSendChange: (enabled: boolean) => void
  onLanguageChange: (language: Language) => void
  onTemplateChange: (templateId: UploadLinkTemplateId | null) => void
  className?: string
}

const LANGUAGE_OPTIONS: Array<{ value: Language; key: string }> = [
  { value: 'EN', key: 'settings.messageLanguageEnglishUs' },
  { value: 'VI', key: 'settings.messageLanguageVietnamese' },
]

export function UploadLinkMessageSettings({
  autoSend,
  language,
  templateId,
  disabled = false,
  allowDefaultTemplate = false,
  name,
  onAutoSendChange,
  onLanguageChange,
  onTemplateChange,
  className,
}: UploadLinkMessageSettingsProps) {
  const { t } = useTranslation()
  const selectedTemplateId = resolveClientSmsTemplateId(templateId)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <MessageSquareText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground">
              {t('settings.sendUploadLinkAfterIntake')}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('settings.sendUploadLinkAfterIntakeDescription')}
            </p>
          </div>
        </div>
        <Switch
          checked={autoSend}
          onCheckedChange={onAutoSendChange}
          disabled={disabled}
          aria-label={t('settings.sendUploadLinkAfterIntake')}
        />
      </div>

      {autoSend ? (
        <div className="space-y-4 rounded-lg border border-border/70 bg-background/60 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('settings.uploadLinkMessageLanguage')}
            </p>
            <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label={t('settings.uploadLinkMessageLanguage')}>
              {LANGUAGE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    language === option.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input
                    type="radio"
                    name={`${name}-language`}
                    value={option.value}
                    checked={language === option.value}
                    onChange={() => onLanguageChange(option.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  {t(option.key)}
                </label>
              ))}
            </div>
          </div>

          <ClientSmsTemplateSelector
            language={language}
            selectedTemplateId={allowDefaultTemplate && templateId === null ? 'inherit' : selectedTemplateId}
            onSelect={(id) => onTemplateChange(id)}
            disabled={disabled}
            name={name}
            labelKey="settings.uploadLinkMessage"
            inheritLabelKey={allowDefaultTemplate ? 'settings.useDefaultUploadMessage' : undefined}
            inheritDescriptionKey={allowDefaultTemplate ? 'settings.useDefaultUploadMessageDescription' : undefined}
            onInherit={allowDefaultTemplate ? () => onTemplateChange(null) : undefined}
            className="mb-0"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('settings.uploadLinkMessageDisabled')}
        </div>
      )}
    </div>
  )
}
