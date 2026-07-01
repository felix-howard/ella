import { describe, expect, it } from 'vitest'
import { shouldSendMessageWithKeyboard } from './quick-actions-bar-keyboard'

describe('QuickActionsBar keyboard shortcuts', () => {
  it('keeps plain Enter available for a newline', () => {
    expect(
      shouldSendMessageWithKeyboard({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toBe(false)
  })

  it('keeps Shift+Enter available for a newline', () => {
    expect(
      shouldSendMessageWithKeyboard({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      })
    ).toBe(false)
  })

  it('sends only with explicit desktop shortcuts', () => {
    expect(
      shouldSendMessageWithKeyboard({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      })
    ).toBe(true)
    expect(
      shouldSendMessageWithKeyboard({
        key: 'Enter',
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
      })
    ).toBe(true)
  })

  it('does not send while an IME composition is active', () => {
    expect(
      shouldSendMessageWithKeyboard({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        nativeEvent: { isComposing: true },
      })
    ).toBe(false)
  })
})
