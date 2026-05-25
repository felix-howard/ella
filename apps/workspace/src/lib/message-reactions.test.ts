import { describe, expect, it } from 'vitest'
import {
  buildMessagesWithTapbackReactions,
  isTapbackReactionMessage,
  parseTapbackReaction,
} from './message-reactions'

const baseMessage = {
  conversationId: 'conv_1',
  channel: 'SMS' as const,
  direction: 'OUTBOUND' as const,
  content: 'Dear Tracy,\nPlease send the documents.',
  attachmentUrls: [],
  createdAt: '2026-05-24T10:00:00.000Z',
}

describe('message reactions', () => {
  it('parses inbound Loved tapback messages', () => {
    expect(parseTapbackReaction('Loved "Dear Tracy, please send docs"')).toEqual({
      type: 'love',
      label: 'Loved',
      quotedText: 'Dear Tracy, please send docs',
    })
    expect(parseTapbackReaction('Loved “Dear Tracy, please send docs”')).toEqual({
      type: 'love',
      label: 'Loved',
      quotedText: 'Dear Tracy, please send docs',
    })
  })

  it('moves a Loved tapback onto the quoted message', () => {
    const messages = buildMessagesWithTapbackReactions([
      {
        ...baseMessage,
        id: 'message_1',
      },
      {
        ...baseMessage,
        id: 'reaction_1',
        direction: 'INBOUND',
        content: 'Loved "Dear Tracy, Please send the documents."',
        createdAt: '2026-05-24T10:01:00.000Z',
      },
    ])

    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('message_1')
    expect(messages[0].reactions).toEqual([
      { id: 'reaction_1', type: 'love', label: 'Loved' },
    ])
  })

  it('keeps unmatched Loved text as a normal message', () => {
    const messages = buildMessagesWithTapbackReactions([
      { ...baseMessage, id: 'message_1' },
      {
        ...baseMessage,
        id: 'message_2',
        direction: 'INBOUND',
        content: 'Loved "something unrelated"',
        createdAt: '2026-05-24T10:01:00.000Z',
      },
    ])

    expect(messages).toHaveLength(2)
    expect(messages[0].reactions).toBeUndefined()
    expect(isTapbackReactionMessage(messages[1])).toBe(true)
  })
})
