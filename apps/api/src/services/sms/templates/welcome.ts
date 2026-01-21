/**
 * Welcome Message Template
 * Sent when a new client is created with magic link
 */

export interface WelcomeTemplateParams {
  clientName: string
  magicLink: string
  taxYear: number
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: WelcomeTemplateParams) =>
    `Xin chào ${params.clientName}!

Chào mừng đến với dịch vụ khai thuế ${params.taxYear}. Vui lòng nhấn vào link dưới đây để gửi hình ảnh tài liệu của bạn:

${params.magicLink}

Cảm ơn bạn!`,

  EN: (params: WelcomeTemplateParams) =>
    `Hello ${params.clientName}!

Welcome to our ${params.taxYear} tax service. Please click the link below to upload your documents:

${params.magicLink}

Thank you!`,
}

export function generateWelcomeMessage(params: WelcomeTemplateParams): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const WELCOME_TEMPLATE_NAME = 'welcome' as const
