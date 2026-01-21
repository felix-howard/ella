/**
 * Messaging components barrel export
 * Client communication thread and message composition
 */

export { MessageBubble, TypingIndicator } from './message-bubble'
export type { MessageBubbleProps } from './message-bubble'

export { MessageThread } from './message-thread'
export type { MessageThreadProps } from './message-thread'

export { QuickActionsBar } from './quick-actions-bar'
export type { QuickActionsBarProps } from './quick-actions-bar'

export { TemplatePicker } from './template-picker'
export type { TemplatePickerProps, MessageTemplate, TemplateCategory } from './template-picker'

export { ConversationList } from './conversation-list'
export type { ConversationListProps } from './conversation-list'

export { ConversationListItem } from './conversation-list-item'
export type { ConversationListItemProps } from './conversation-list-item'

export { CallButton } from './call-button'
export type { CallButtonProps } from './call-button'

export { ActiveCallModal } from './active-call-modal'
export type { ActiveCallModalProps } from './active-call-modal'

export { AudioPlayer } from './audio-player'
export type { AudioPlayerProps } from './audio-player'
