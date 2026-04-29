/**
 * chat-quick-templates - Context-driven message templates for QuickActionsBar.
 * Case context uses dynamic links (portal, schedule E/C, shared docs) fetched
 * server-side — handled inline in QuickActionsBar. Lead context uses static
 * templates listed here.
 */
import type { ChatContext } from '../types/chat-context'

export type QuickTemplateIcon = 'file-text' | 'calendar' | 'link'

export interface QuickTemplate {
  /** Stable key for React lists + i18n lookup. */
  key: string
  /** Icon identifier resolved by the consumer. */
  icon: QuickTemplateIcon
  /** Display label (i18n key). */
  labelKey: string
  /**
   * Text inserted into the composer when the user picks the template.
   * Undefined means the consumer owns the insert logic (e.g., async link fetch).
   */
  text?: string
}

const LEAD_TEMPLATES: QuickTemplate[] = [
  {
    key: 'lead-send-nda',
    icon: 'file-text',
    labelKey: 'chat.templates.sendNdaLink',
    text: 'Please review and sign the NDA: ',
  },
  {
    key: 'lead-follow-up',
    icon: 'calendar',
    labelKey: 'chat.templates.scheduleFollowUp',
    text: 'Following up on our previous conversation — let me know a good time to chat.',
  },
]

export function getQuickTemplates(context: ChatContext): QuickTemplate[] {
  return context.type === 'lead' ? LEAD_TEMPLATES : []
}
