import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MessageBubble } from './message-bubble'
import type { Message } from '../../lib/api-client'

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

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'messages.channel.sms': 'SMS',
        'messages.englishSourceLabel': 'English source',
        'messages.hideEnglishSource': 'Hide English',
        'messages.showEnglishSource': 'Show English',
        'messages.translate': 'Translate',
        'messages.translating': 'Translating...',
      }
      return labels[key] ?? fallback ?? key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
    }
  },
  api: {
    messages: {
      translate: vi.fn(),
    },
  },
  fetchMediaBlobUrl: vi.fn(),
}))

function message(overrides: Partial<Message>): Message {
  return {
    id: 'msg_1',
    conversationId: 'case_1',
    channel: 'SMS',
    direction: 'OUTBOUND',
    content: 'Em can anh/chi gui W-2 nam 2025.',
    createdAt: '2026-06-29T10:00:00.000Z',
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('renders a collapsed Show English toggle for translated outbound messages', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble
        message={message({
          contentLanguage: 'VI',
          staffAuthoredContent: 'Please send your 2025 W-2.',
          staffAuthoredLanguage: 'EN',
          translationEdited: true,
        })}
      />
    )

    expect(markup).toContain('Em can anh/chi gui W-2 nam 2025.')
    expect(markup).toContain('Show English')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('Please send your 2025 W-2.')
  })

  it('keeps inbound translation action separate from staff source display', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble
        message={message({
          direction: 'INBOUND',
          content: 'Toi da gui W-2 roi.',
          staffAuthoredContent: null,
        })}
      />
    )

    expect(markup).toContain('aria-label="Translate"')
    expect(markup).not.toContain('Show English')
  })

  it('does not show English source for non-SMS or partial translation metadata', () => {
    const portalMarkup = renderToStaticMarkup(
      <MessageBubble
        message={message({
          channel: 'PORTAL',
          contentLanguage: 'VI',
          staffAuthoredContent: 'Please send your 2025 W-2.',
          staffAuthoredLanguage: 'EN',
        })}
      />
    )
    const partialMarkup = renderToStaticMarkup(
      <MessageBubble
        message={message({
          contentLanguage: 'VI',
          staffAuthoredContent: 'Please send your 2025 W-2.',
          staffAuthoredLanguage: null,
        })}
      />
    )

    expect(portalMarkup).not.toContain('Show English')
    expect(partialMarkup).not.toContain('Show English')
  })
})
