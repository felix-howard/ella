export interface ComposerKeyboardShortcutEvent {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  nativeEvent?: {
    isComposing?: boolean
  }
}

export function shouldSendMessageWithKeyboard(event: ComposerKeyboardShortcutEvent): boolean {
  if (event.nativeEvent?.isComposing) return false
  return event.key === 'Enter' && !event.shiftKey && Boolean(event.metaKey || event.ctrlKey)
}
