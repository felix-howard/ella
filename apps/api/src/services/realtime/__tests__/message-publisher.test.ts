import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({
  getSupabaseUrl: vi.fn(() => 'https://example.supabase.co'),
  getSupabaseHeaders: vi.fn(() => ({
    'Content-Type': 'application/json',
    apikey: 'service-role-key',
    Authorization: 'Bearer service-role-key',
  })),
  isSupabaseConfigured: vi.fn(() => true),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {},
}))

import { publishMessageEvent } from '../message-publisher'

describe('publishMessageEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('sends Supabase batch broadcast messages with topic, event, and payload', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    const payload = {
      eventType: 'message.created' as const,
      conversationId: 'conv_1',
      caseId: 'case_1',
      messageId: 'msg_1',
      direction: 'INBOUND' as const,
      channel: 'SMS' as const,
      timestamp: '2026-06-20T12:05:42.000Z',
    }

    await publishMessageEvent('org_1', payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/realtime/v1/api/broadcast',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              topic: 'org:org_1:messages',
              event: 'message',
              payload,
            },
          ],
        }),
      })
    )
  })
})
