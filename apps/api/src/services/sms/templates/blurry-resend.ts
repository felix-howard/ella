/**
 * Blurry Image Resend Request Template
 * Sent when AI detects blurry document images
 */

export interface BlurryResendTemplateParams {
  clientName: string
  magicLink: string
  docTypes: string[]
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: BlurryResendTemplateParams) => {
    const docsList = params.docTypes.join(', ')

    return `Xin chào ${params.clientName},

Chúng tôi nhận được ảnh của bạn nhưng một số hình bị mờ hoặc không rõ:
${docsList}

Vui lòng chụp lại và gửi tại: ${params.magicLink}

Mẹo: Đảm bảo ánh sáng tốt và giữ điện thoại thẳng.

Cảm ơn bạn!`
  },

  EN: (params: BlurryResendTemplateParams) => {
    const docsList = params.docTypes.join(', ')

    return `Hi ${params.clientName},

We received your images but some are blurry or unclear:
${docsList}

Please retake and upload at: ${params.magicLink}

Tip: Ensure good lighting and hold your phone steady.

Thank you!`
  },
}

export function generateBlurryResendMessage(
  params: BlurryResendTemplateParams
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const BLURRY_RESEND_TEMPLATE_NAME = 'blurry_resend' as const
