import { describe, expect, it } from 'vitest'
import { adjustUnreadCount, getConversationUnreadPatch } from '../hooks/use-realtime-messages'
import type { Conversation } from '../lib/api-client'

function conversation(caseId: string, unreadCount: number): Conversation {
  return {
    id: `conv_${caseId}`,
    caseId,
    unreadCount,
    lastMessage: null,
    lastMessageAt: null,
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    client: {
      id: `client_${caseId}`,
      name: `Client ${caseId}`,
      phone: '+15550000000',
      language: 'EN',
    },
    taxCase: {
      id: caseId,
      taxYear: 2025,
      status: 'IN_PROGRESS',
    },
  }
}

describe('messages unread patching', () => {
  it('clears the active conversation and subtracts only its previous unread count', () => {
    const patch = getConversationUnreadPatch(
      [conversation('case_1', 3), conversation('case_2', 2)],
      'case_1',
      0
    )

    expect(patch.changed).toBe(true)
    expect(patch.previousUnreadCount).toBe(3)
    expect(patch.nextUnreadCount).toBe(0)
    expect(patch.conversations.map((item) => [item.caseId, item.unreadCount])).toEqual([
      ['case_1', 0],
      ['case_2', 2],
    ])
    expect(adjustUnreadCount(5, patch.previousUnreadCount, patch.nextUnreadCount)).toBe(2)
  })

  it('applies realtime read counts without letting totals go negative', () => {
    const patch = getConversationUnreadPatch([conversation('case_1', 5)], 'case_1', 1)

    expect(patch.conversations[0]?.unreadCount).toBe(1)
    expect(adjustUnreadCount(3, patch.previousUnreadCount, patch.nextUnreadCount)).toBe(0)
  })

  it('ignores unchanged counts so realtime duplicate events do not churn state', () => {
    const conversations = [conversation('case_1', 0)]
    const patch = getConversationUnreadPatch(conversations, 'case_1', 0)

    expect(patch.changed).toBe(false)
    expect(patch.conversations).toBe(conversations)
  })
})
