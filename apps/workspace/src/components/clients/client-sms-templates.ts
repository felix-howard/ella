import en from '../../locales/en.json'
import vi from '../../locales/vi.json'

export type ClientSmsLanguage = 'VI' | 'EN'

export type ClientSmsTemplateId = 'official-channel' | 'tax-documents'

export type ClientSmsTemplate = {
  id: ClientSmsTemplateId
  labelKey: string
  messageKey: string
  messages: Record<ClientSmsLanguage, string>
}

const TEMPLATE_MESSAGE_KEYS: Record<ClientSmsTemplateId, string> = {
  'official-channel': 'clientSmsTemplates.officialChannel.message',
  'tax-documents': 'clientSmsTemplates.taxDocuments.message',
}

const SMS_TEMPLATE_LOCALES = {
  EN: en,
  VI: vi,
}

function getSmsTemplateMessage(templateId: ClientSmsTemplateId, language: ClientSmsLanguage): string {
  const key = TEMPLATE_MESSAGE_KEYS[templateId]
  const value = SMS_TEMPLATE_LOCALES[language][key as keyof typeof en]
  return typeof value === 'string' ? value : ''
}

export const OFFICIAL_CHANNEL_SMS_TEMPLATE_EN = getSmsTemplateMessage('official-channel', 'EN')

export const OFFICIAL_CHANNEL_SMS_TEMPLATE_VI = getSmsTemplateMessage('official-channel', 'VI')

export const DEFAULT_SMS_TEMPLATE_VI = getSmsTemplateMessage('tax-documents', 'VI')

export const DEFAULT_SMS_TEMPLATE_EN = getSmsTemplateMessage('tax-documents', 'EN')

export const DEFAULT_CLIENT_SMS_TEMPLATE_ID: ClientSmsTemplateId = 'official-channel'

export const CLIENT_SMS_TEMPLATES: ClientSmsTemplate[] = [
  {
    id: 'official-channel',
    labelKey: 'confirmStep.templateOfficialChannel',
    messageKey: TEMPLATE_MESSAGE_KEYS['official-channel'],
    messages: {
      EN: OFFICIAL_CHANNEL_SMS_TEMPLATE_EN,
      VI: OFFICIAL_CHANNEL_SMS_TEMPLATE_VI,
    },
  },
  {
    id: 'tax-documents',
    labelKey: 'confirmStep.templateTaxDocuments',
    messageKey: TEMPLATE_MESSAGE_KEYS['tax-documents'],
    messages: {
      EN: DEFAULT_SMS_TEMPLATE_EN,
      VI: DEFAULT_SMS_TEMPLATE_VI,
    },
  },
]

const PORTAL_LINK_PLACEHOLDER = /\{\{\s*portal_link\s*\}\}/

export function getClientSmsTemplate(templateId: ClientSmsTemplateId, language: ClientSmsLanguage): string {
  return CLIENT_SMS_TEMPLATES.find((template) => template.id === templateId)?.messages[language]
    ?? CLIENT_SMS_TEMPLATES[0].messages[language]
}

export function resolveClientSmsTemplateId(value: string | null | undefined): ClientSmsTemplateId {
  return value === 'official-channel' || value === 'tax-documents'
    ? value
    : DEFAULT_CLIENT_SMS_TEMPLATE_ID
}

export function hasPortalLinkPlaceholder(message: string): boolean {
  return PORTAL_LINK_PLACEHOLDER.test(message)
}

export function ensurePortalLinkPlaceholder(message: string): string {
  if (hasPortalLinkPlaceholder(message)) {
    return message
  }

  const trimmedMessage = message.trimEnd()
  return trimmedMessage ? `${trimmedMessage}\n{{portal_link}}` : '{{portal_link}}'
}
