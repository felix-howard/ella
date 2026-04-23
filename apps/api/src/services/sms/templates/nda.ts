/**
 * NDA Invite Message Template
 * Sent when staff dispatches an NDA signing link to a Lead.
 */

export interface NdaTemplateParams {
  firstName: string
  ndaUrl: string
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: NdaTemplateParams) =>
    `Chào ${params.firstName},

Vui lòng xem và ký NDA của Ella trước buổi tư vấn: ${params.ndaUrl}

Liên kết có hiệu lực 7 ngày. Soạn HELP để được hỗ trợ.`,

  EN: (params: NdaTemplateParams) =>
    `Hi ${params.firstName}, please review and sign Ella's NDA before our consultation: ${params.ndaUrl}
Valid for 7 days. Reply HELP for assistance.`,
}

export function generateNdaMessage(params: NdaTemplateParams): string {
  const template = TEMPLATES[params.language] || TEMPLATES.EN
  return template(params)
}

export const NDA_TEMPLATE_NAME = 'nda' as const
