import { describe, expect, it, vi } from 'vitest'
import { isLikelyServerCopy, mergeFetchedMessages } from './optimistic-message-merge'
import type { Message } from './api-client'
import type { OptimisticMessage } from './optimistic-message-merge'

function message(overrides: Partial<Message>): Message {
  return {
    id: 'msg_1',
    conversationId: 'case_1',
    channel: 'SMS',
    direction: 'OUTBOUND',
    content: 'hello',
    createdAt: '2026-06-19T10:00:00.000Z',
    ...overrides,
  }
}

function optimistic(overrides: Partial<OptimisticMessage>): OptimisticMessage {
  return {
    ...message({ id: 'temp-1' }),
    _optimistic: 'sending',
    ...overrides,
  }
}

describe('optimistic message merge', () => {
  it('allows bounded server clock skew when matching a committed send', () => {
    const retry = optimistic({
      id: 'temp-retry',
      createdAt: '2026-06-19T10:00:02.000Z',
    })
    const skewedServerMessage = message({
      id: 'msg-skewed',
      createdAt: '2026-06-19T10:00:01.000Z',
    })

    expect(isLikelyServerCopy(retry, skewedServerMessage)).toBe(true)
  })

  it('keeps a later duplicate-text optimistic send when the matching server copy was already visible', () => {
    const revoke = vi.fn()
    const second = optimistic({
      id: 'temp-second',
      createdAt: '2026-06-19T10:00:02.000Z',
    })
    const serverCopy = message({
      id: 'msg_first',
      createdAt: '2026-06-19T10:00:01.000Z',
    })

    const merged = mergeFetchedMessages([serverCopy, second], [serverCopy], revoke)

    expect(merged.map((item) => item.id)).toEqual(['msg_first', 'temp-second'])
    expect(revoke).not.toHaveBeenCalled()
  })

  it('consumes only one new server copy per optimistic message', () => {
    const revoke = vi.fn()
    const first = optimistic({
      id: 'temp-first',
      createdAt: '2026-06-19T10:00:00.000Z',
    })
    const second = optimistic({
      id: 'temp-second',
      createdAt: '2026-06-19T10:00:02.000Z',
    })
    const serverCopy = message({
      id: 'msg_first',
      createdAt: '2026-06-19T10:00:01.000Z',
    })

    const merged = mergeFetchedMessages([first, second], [serverCopy], revoke)

    expect(merged.map((item) => item.id)).toEqual(['msg_first', 'temp-second'])
    expect(revoke).toHaveBeenCalledTimes(1)
  })

  it('removes a failed temp when a later server copy confirms the send committed', () => {
    const failed = optimistic({
      id: 'temp-failed',
      _optimistic: 'failed',
      createdAt: '2026-06-19T10:00:00.000Z',
    })
    const serverCopy = message({
      id: 'msg_committed',
      createdAt: '2026-06-19T10:00:03.000Z',
    })

    const merged = mergeFetchedMessages([failed], [serverCopy], vi.fn())

    expect(merged.map((item) => item.id)).toEqual(['msg_committed'])
  })
})
