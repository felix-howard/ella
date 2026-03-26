/**
 * Staff Chat Monitor Notification Template
 * Sent to admin when a monitored staff member sends messages to a client
 *
 * Constraints:
 * - Must be under 160 chars (GSM-7 to avoid multi-segment billing)
 * - No emojis or special chars (avoid UCS-2 encoding)
 * - Short, actionable message
 */

export interface StaffChatMonitorTemplateParams {
  staffName: string
  clientName: string
  messageCount: number
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: StaffChatMonitorTemplateParams) => {
    const { staffName, messageCount, clientName } = params
    return `[Ella] ${staffName} da gui ${messageCount} tin nhan cho ${clientName}.`
  },

  EN: (params: StaffChatMonitorTemplateParams) => {
    const { staffName, messageCount, clientName } = params
    const word = messageCount === 1 ? 'message' : 'messages'
    return `[Ella] ${staffName} sent ${messageCount} ${word} to ${clientName}.`
  },
}

export function generateStaffChatMonitorMessage(
  params: StaffChatMonitorTemplateParams
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const STAFF_CHAT_MONITOR_TEMPLATE_NAME = 'staff_chat_monitor' as const
