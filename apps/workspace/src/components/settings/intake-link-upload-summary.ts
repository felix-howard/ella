import type { Language, UploadLinkTemplateId } from '../../lib/api-client'
import {
  CLIENT_SMS_TEMPLATES,
  DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  resolveClientSmsTemplateId,
} from '../clients/client-sms-templates'

export function formatUploadSummary(
  t: (key: string, options?: Record<string, string>) => string,
  autoSend: boolean,
  language: Language,
  templateId: UploadLinkTemplateId | null
) {
  if (!autoSend) return t('settings.uploadMessageOff')
  const resolvedTemplateId = templateId ? resolveClientSmsTemplateId(templateId) : DEFAULT_CLIENT_SMS_TEMPLATE_ID
  const template = CLIENT_SMS_TEMPLATES.find((item) => item.id === resolvedTemplateId)
  const templateLabel = template ? t(template.labelKey) : resolvedTemplateId
  return t('settings.uploadMessageSummary', {
    language: language === 'EN' ? t('settings.messageLanguageEnglishUs') : t('settings.messageLanguageVietnamese'),
    template: templateId ? templateLabel : t('settings.useDefaultUploadMessage', { template: templateLabel }),
  })
}
