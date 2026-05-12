import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import {
  CLIENT_SMS_TEMPLATES,
  getClientSmsTemplate,
  type ClientSmsLanguage,
  type ClientSmsTemplateId,
} from './client-sms-templates'

interface ClientSmsTemplateSelectorProps {
  language: ClientSmsLanguage
  selectedTemplateId: ClientSmsTemplateId
  onSelect: (templateId: ClientSmsTemplateId, message: string) => void
}

export function ClientSmsTemplateSelector({
  language,
  selectedTemplateId,
  onSelect,
}: ClientSmsTemplateSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t('confirmStep.templateLabel')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('confirmStep.templateLabel')}>
        {CLIENT_SMS_TEMPLATES.map((template) => {
          const isSelected = selectedTemplateId === template.id
          return (
            <label
              key={template.id}
              className={cn(
                'flex min-h-[96px] cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                name="clientSmsTemplate"
                checked={isSelected}
                onChange={() => onSelect(template.id, getClientSmsTemplate(template.id, language))}
                className="sr-only"
              />
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-primary' : 'border-muted-foreground/60'
                )}
                aria-hidden="true"
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  {t(template.labelKey)}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {template.messages[language]}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
