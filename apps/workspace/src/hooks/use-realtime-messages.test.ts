import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import {
  adjustUnreadCount,
  getMessageEventType,
  invalidateMessageEventQueries,
  subtractUnreadCount,
} from './use-realtime-messages'
import type { MessageEventPayload } from './use-realtime-messages'

describe('useRealtimeMessages helpers', () => {
  it('treats legacy events without eventType as message.created', () => {
    const payload: MessageEventPayload = {
      messageId: 'msg_1',
      caseId: 'case_1',
      direction: 'INBOUND',
      channel: 'SMS',
      timestamp: '2026-06-19T00:00:00.000Z',
    }

    expect(getMessageEventType(payload)).toBe('message.created')
  })

  it('accepts lead read events', () => {
    const payload: MessageEventPayload = {
      eventType: 'lead.read',
      leadId: 'lead_1',
      unreadCount: 0,
      readAt: '2026-06-28T00:00:00.000Z',
      timestamp: '2026-06-28T00:00:00.000Z',
    }

    expect(getMessageEventType(payload)).toBe('lead.read')
  })

  it('keeps unread count subtraction bounded at zero', () => {
    expect(subtractUnreadCount(5, 2)).toBe(3)
    expect(subtractUnreadCount(2, 5)).toBe(0)
    expect(subtractUnreadCount(undefined, 1)).toBe(0)
    expect(subtractUnreadCount(3, -5)).toBe(3)
  })

  it('adjusts total unread count when one conversation changes', () => {
    expect(adjustUnreadCount(10, 4, 0)).toBe(6)
    expect(adjustUnreadCount(6, 0, 2)).toBe(8)
    expect(adjustUnreadCount(1, 5, 0)).toBe(0)
  })

  it('invalidates lead detail caches for lead message events', () => {
    const queryClient = { invalidateQueries: vi.fn() }

    invalidateMessageEventQueries(queryClient, {
      eventType: 'message.created',
      messageId: 'msg_1',
      leadId: 'lead_1',
      direction: 'INBOUND',
      channel: 'SMS',
      timestamp: '2026-06-28T00:00:00.000Z',
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lead', 'lead_1'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['lead-unread-summary'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['actions'] })
  })
})
