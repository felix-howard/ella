/**
 * Documents Complete Template
 * Sent when all required documents have been received
 */

export interface CompleteTemplateParams {
  clientName: string
  taxYear: number
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: CompleteTemplateParams) =>
    `Xin chào ${params.clientName}!

Tuyệt vời! Chúng tôi đã nhận đủ tất cả tài liệu cho hồ sơ thuế ${params.taxYear} của bạn.

Nhân viên của chúng tôi sẽ bắt đầu xử lý và liên hệ nếu cần thêm thông tin.

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!`,

  EN: (params: CompleteTemplateParams) =>
    `Hi ${params.clientName}!

Great news! We've received all documents for your ${params.taxYear} tax filing.

Our team will begin processing and contact you if any additional information is needed.

Thank you for using our service!`,
}

export function generateCompleteMessage(params: CompleteTemplateParams): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const COMPLETE_TEMPLATE_NAME = 'complete' as const
