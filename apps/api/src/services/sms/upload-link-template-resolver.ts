import type { SmsLanguage } from './templates'

export type UploadLinkTemplateId = 'official-channel' | 'tax-documents'

export const DEFAULT_UPLOAD_LINK_TEMPLATE_ID: UploadLinkTemplateId = 'official-channel'

export const UPLOAD_LINK_TEMPLATE_IDS = ['official-channel', 'tax-documents'] as const

const UPLOAD_LINK_TEMPLATES: Record<UploadLinkTemplateId, Record<SmsLanguage, string>> = {
  'official-channel': {
    EN: `Hi {{client_name}}, this is Ella Tax Services LLC'S official communication channel. Please use the secure link below to upload your documents: {{portal_link}}`,
    VI: `Hi {{client_name}}, đây là kênh liên lạc chính thức của Ella Tax Services LLC. Vui lòng sử dụng link bảo mật sau để tải lên các tài liệu của bạn: {{portal_link}}`,
  },
  'tax-documents': {
    EN: `Hello {{client_name}}, to prepare your {{tax_year}} tax documents, please send your prior year 1040 tax return, copy of ID, social security card, W2/1099 income forms, 1095A insurance form, and other required documents via the link: {{portal_link}}`,
    VI: `Xin chào {{client_name}}, để chuẩn bị hồ sơ thuế năm {{tax_year}}, vui lòng gửi 1040 của khai thuế năm trước, copy of ID, social, thu nhập W2/1099, bảo hiểm 1095A và các tài liệu cần thiết qua link: {{portal_link}}`,
  },
}

export function isUploadLinkTemplateId(value: unknown): value is UploadLinkTemplateId {
  return value === 'official-channel' || value === 'tax-documents'
}

export function resolveUploadLinkTemplateId(value: string | null | undefined): UploadLinkTemplateId {
  return isUploadLinkTemplateId(value) ? value : DEFAULT_UPLOAD_LINK_TEMPLATE_ID
}

export function resolveUploadLinkTemplateMessage(
  value: string | null | undefined,
  language: SmsLanguage
): string {
  const templateId = resolveUploadLinkTemplateId(value)
  return UPLOAD_LINK_TEMPLATES[templateId][language] ?? UPLOAD_LINK_TEMPLATES[DEFAULT_UPLOAD_LINK_TEMPLATE_ID].EN
}
