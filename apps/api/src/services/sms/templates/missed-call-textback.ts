/**
 * Missed Call Text-Back Template
 * Sent automatically when a client's call is missed (no-answer, busy, failed)
 */

export interface MissedCallTextbackParams {
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: () =>
    `Xin chào! Chúng tôi nhận được cuộc gọi của bạn nhưng hiện tại đang bận. Vui lòng nhắn tin cho chúng tôi tại đây về vấn đề bạn cần hỗ trợ, chúng tôi sẽ phản hồi sớm nhất có thể. Cảm ơn bạn!`,

  EN: () =>
    `Hello! We received your call but are currently busy. Please text us here what you need help with and we'll get back to you as soon as possible. Thank you!`,
}

export function generateMissedCallTextbackMessage(
  params: MissedCallTextbackParams
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template()
}

export const MISSED_CALL_TEXTBACK_TEMPLATE_NAME = 'missed_call_textback' as const
