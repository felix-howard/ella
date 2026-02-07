/**
 * Schedule E Rental Property Form Message Template
 * Sent when CPA requests rental property information from client
 */

export interface ScheduleETemplateParams {
  clientName: string
  magicLink: string
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: ScheduleETemplateParams) =>
    `Chào ${params.clientName},

CPA của bạn cần thông tin về nhà cho thuê để hoàn thành Schedule E.

Vui lòng điền form tại: ${params.magicLink}

Form này giúp khai báo thu nhập và chi phí từ cho thuê nhà như: bảo hiểm, lãi vay, sửa chữa, thuế, tiện ích, v.v.

Link có hiệu lực 7 ngày.`,

  EN: (params: ScheduleETemplateParams) =>
    `Hi ${params.clientName},

Your CPA needs rental property information to complete Schedule E.

Please fill out the form at: ${params.magicLink}

This form helps report rental income and expenses like: insurance, mortgage interest, repairs, taxes, utilities, etc.

Link expires in 7 days.`,
}

export function generateScheduleEMessage(params: ScheduleETemplateParams): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const SCHEDULE_E_TEMPLATE_NAME = 'schedule_e' as const
