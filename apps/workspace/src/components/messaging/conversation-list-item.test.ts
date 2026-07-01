import { describe, expect, it } from 'vitest'
import { getConversationMessagePreview } from './conversation-message-preview'
import type { Conversation } from '../../lib/api-client'

type LastMessage = NonNullable<Conversation['lastMessage']>

class TestDOMParser {
  parseFromString(text: string) {
    return {
      body: {
        textContent: text.replace(/<[^>]*>/g, ''),
      },
    }
  }
}

globalThis.DOMParser = TestDOMParser as unknown as typeof DOMParser

const t = (key: string, options?: string | Record<string, unknown>) =>
  typeof options === 'string' ? options : key

function lastMessage(overrides: Partial<LastMessage>): LastMessage {
  return {
    id: 'msg_1',
    content: 'Hello',
    channel: 'SMS',
    direction: 'OUTBOUND',
    createdAt: '2026-06-29T10:00:00.000Z',
    updatedAt: '2026-06-29T10:00:00.000Z',
    ...overrides,
  }
}

describe('getConversationMessagePreview', () => {
  it('uses staff-authored English source for translated outbound text', () => {
    const preview = getConversationMessagePreview(
      lastMessage({
        content: 'Em can anh/chi gui W-2 nam 2025.',
        contentLanguage: 'VI',
        staffAuthoredContent: 'Please send your 2025 W-2.',
        staffAuthoredLanguage: 'EN',
        translationEdited: true,
      }),
      t
    )

    expect(preview).toBe('Please send your 2025 W-2.')
  })

  it('keeps inbound previews on the actual message content', () => {
    const preview = getConversationMessagePreview(
      lastMessage({
        direction: 'INBOUND',
        content: 'Toi da gui W-2 roi.',
        staffAuthoredContent: 'I sent the W-2.',
      }),
      t
    )

    expect(preview).toBe('Toi da gui W-2 roi.')
  })

  it('uses actual outbound content when English source metadata is incomplete', () => {
    const preview = getConversationMessagePreview(
      lastMessage({
        content: 'Em can anh/chi gui W-2 nam 2025.',
        contentLanguage: 'VI',
        staffAuthoredContent: 'Please send your 2025 W-2.',
        staffAuthoredLanguage: null,
      }),
      t
    )

    expect(preview).toBe('Em can anh/chi gui W-2 nam 2025.')
  })

  it('uses actual outbound content for non-SMS staff-source metadata', () => {
    const preview = getConversationMessagePreview(
      lastMessage({
        channel: 'PORTAL',
        content: 'Portal message body',
        contentLanguage: 'VI',
        staffAuthoredContent: 'English portal source',
        staffAuthoredLanguage: 'EN',
      }),
      t
    )

    expect(preview).toBe('Portal message body')
  })

  it('keeps attachment-only previews as photo messages', () => {
    const preview = getConversationMessagePreview(
      lastMessage({
        content: '',
        attachmentUrls: ['/messages/media/msg_1/0'],
        staffAuthoredContent: 'Please see attached.',
      }),
      t
    )

    expect(preview).toBe('Sent a photo')
  })
})
