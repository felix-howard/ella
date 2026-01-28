/**
 * Schedule C Expense Form Message Template
 * Sent when CPA requests business expense information from self-employed client
 */

export interface ScheduleCTemplateParams {
  clientName: string
  magicLink: string
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: ScheduleCTemplateParams) =>
    `Chào ${params.clientName},

CPA của bạn cần thông tin chi phí kinh doanh để hoàn thành Schedule C.

Vui lòng điền form tại: ${params.magicLink}

Form này giúp giảm thuế bằng cách kê khai chi phí như: tiền xăng, vật tư, quảng cáo, tiền thuê, v.v.

Link có hiệu lực 7 ngày.`,

  EN: (params: ScheduleCTemplateParams) =>
    `Hi ${params.clientName},

Your CPA needs business expense information to complete Schedule C.

Please fill out the form at: ${params.magicLink}

This form helps reduce taxes by claiming expenses like: mileage, supplies, advertising, rent, etc.

Link expires in 7 days.`,
}

export function generateScheduleCMessage(params: ScheduleCTemplateParams): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const SCHEDULE_C_TEMPLATE_NAME = 'schedule_c' as const
