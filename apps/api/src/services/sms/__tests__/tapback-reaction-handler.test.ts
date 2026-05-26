import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '../../../lib/db'
import { processTapbackReaction } from '../tapback-reaction-handler'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processTapbackReaction', () => {
  it('appends Loved Tapback to the quoted message instead of creating a new message', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'message_1',
        content: 'Dear Tracy,\nPlease send the documents.',
        reactions: [],
      },
    ] as never)
    vi.mocked(prisma.message.update).mockResolvedValueOnce({ id: 'message_1' } as never)

    const result = await processTapbackReaction({
      conversationId: 'conv_1',
      content: 'Loved "Dear Tracy, Please send the documents."',
      twilioSid: 'SM_reaction_1',
      createdAt: new Date('2026-05-24T10:00:00.000Z'),
    })

    expect(result).toEqual({ targetMessageId: 'message_1', duplicate: false })
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'message_1' },
      data: {
        reactions: [
          {
            id: 'SM_reaction_1',
            type: 'love',
            label: 'Loved',
            createdAt: '2026-05-24T10:00:00.000Z',
            twilioSid: 'SM_reaction_1',
          },
        ],
      },
    })
  })

  it('does not append a duplicate Twilio Tapback', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'message_1',
        content: 'Dear Tracy, please send docs.',
        reactions: [{ id: 'SM_reaction_1', type: 'love', label: 'Loved', twilioSid: 'SM_reaction_1' }],
      },
    ] as never)

    const result = await processTapbackReaction({
      conversationId: 'conv_1',
      content: 'Loved "Dear Tracy, please send docs."',
      twilioSid: 'SM_reaction_1',
    })

    expect(result).toEqual({ targetMessageId: 'message_1', duplicate: true })
    expect(prisma.message.update).not.toHaveBeenCalled()
  })

  it('returns null when the quoted message cannot be found', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      { id: 'message_1', content: 'Different message', reactions: [] },
    ] as never)

    const result = await processTapbackReaction({
      conversationId: 'conv_1',
      content: 'Loved "Dear Tracy, please send docs."',
      twilioSid: 'SM_reaction_1',
    })

    expect(result).toBeNull()
    expect(prisma.message.update).not.toHaveBeenCalled()
  })
})
