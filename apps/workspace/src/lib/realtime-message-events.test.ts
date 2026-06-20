import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeToRealtimeMessageEvents } from './realtime-message-events'
import { getSupabaseClient } from './supabase'
import type { MessageEventPayload } from './realtime-message-events'

vi.mock('./supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

function createSupabaseMock() {
  const handlers: Array<(payload: { payload: MessageEventPayload }) => void> = []
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: (payload: { payload: MessageEventPayload }) => void) => {
      handlers.push(handler)
      return channel
    }),
    subscribe: vi.fn(() => channel),
  }
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }

  return { channel, handlers, supabase }
}

describe('subscribeToRealtimeMessageEvents', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shares one channel per org and fans out events to every listener', () => {
    const { handlers, supabase } = createSupabaseMock()
    vi.mocked(getSupabaseClient).mockReturnValue(supabase as never)

    const firstListener = vi.fn()
    const secondListener = vi.fn()

    const cleanupFirst = subscribeToRealtimeMessageEvents('org_1', firstListener)
    const cleanupSecond = subscribeToRealtimeMessageEvents('org_1', secondListener)

    expect(supabase.channel).toHaveBeenCalledTimes(1)
    expect(supabase.channel).toHaveBeenCalledWith('org:org_1:messages')

    const event: MessageEventPayload = {
      eventType: 'message.created',
      messageId: 'msg_1',
      caseId: 'case_1',
      direction: 'INBOUND',
      channel: 'SMS',
      timestamp: '2026-06-20T00:00:00.000Z',
    }
    handlers[0]?.({ payload: event })

    expect(firstListener).toHaveBeenCalledWith(event)
    expect(secondListener).toHaveBeenCalledWith(event)

    cleanupFirst()
    handlers[0]?.({ payload: event })

    expect(firstListener).toHaveBeenCalledTimes(1)
    expect(secondListener).toHaveBeenCalledTimes(2)
    expect(supabase.removeChannel).not.toHaveBeenCalled()

    cleanupSecond()

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
  })
})
