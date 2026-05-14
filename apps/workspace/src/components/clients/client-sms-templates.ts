export type ClientSmsLanguage = 'VI' | 'EN'

export type ClientSmsTemplateId = 'official-channel' | 'tax-documents'

export type ClientSmsTemplate = {
  id: ClientSmsTemplateId
  labelKey: string
  messages: Record<ClientSmsLanguage, string>
}

export const OFFICIAL_CHANNEL_SMS_TEMPLATE_EN = `Hi {{client_name}}, this is Ella Tax Services LLC'S official communication channel. Please use the secure link below to upload your documents: {{portal_link}}`

export const OFFICIAL_CHANNEL_SMS_TEMPLATE_VI = `Hi {{client_name}}, đây là kênh liên lạc chính thức của Ella Tax Services LLC. Vui lòng sử dụng link bảo mật sau để tải lên các tài liệu của bạn: {{portal_link}}`

export const DEFAULT_SMS_TEMPLATE_VI = `Xin chào {{client_name}}, để chuẩn bị hồ sơ thuế năm {{tax_year}}, vui lòng gửi 1040 của khai thuế năm trước, copy of ID, social, thu nhập W2/1099, bảo hiểm 1095A và các tài liệu cần thiết qua link: {{portal_link}}`

export const DEFAULT_SMS_TEMPLATE_EN = `Hello {{client_name}}, to prepare your {{tax_year}} tax documents, please send your prior year 1040 tax return, copy of ID, social security card, W2/1099 income forms, 1095A insurance form, and other required documents via the link: {{portal_link}}`

export const DEFAULT_CLIENT_SMS_TEMPLATE_ID: ClientSmsTemplateId = 'official-channel'

export const CLIENT_SMS_TEMPLATES: ClientSmsTemplate[] = [
  {
    id: 'official-channel',
    labelKey: 'confirmStep.templateOfficialChannel',
    messages: {
      EN: OFFICIAL_CHANNEL_SMS_TEMPLATE_EN,
      VI: OFFICIAL_CHANNEL_SMS_TEMPLATE_VI,
    },
  },
  {
    id: 'tax-documents',
    labelKey: 'confirmStep.templateTaxDocuments',
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
