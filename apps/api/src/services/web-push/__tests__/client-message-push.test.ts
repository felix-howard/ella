import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveClientMessagePushRecipients: vi.fn(),
  sendWebPushToStaff: vi.fn(),
}))

vi.mock('../recipient-resolver', () => ({
  resolveClientMessagePushRecipients: mocks.resolveClientMessagePushRecipients,
}))

vi.mock('../push-delivery-service', () => ({
  sendWebPushToStaff: mocks.sendWebPushToStaff,
}))

import { sendWebPushToStaff } from '../push-delivery-service'
import { notifyClientMessagePushFromConversation } from '../client-message-push'
import { resolveClientMessagePushRecipients } from '../recipient-resolver'

const sentResult = {
  configured: true,
  attempted: 1,
  sent: 1,
  failed: 0,
  disabled: 0,
  failures: [],
}

describe('notifyClientMessagePushFromConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveClientMessagePushRecipients).mockResolvedValue({
      conversationId: 'conv_1',
      caseId: 'case_1',
      clientId: 'client_1',
      organizationId: 'org_1',
      staffIds: ['admin_1', 'staff_1'],
    })
    vi.mocked(sendWebPushToStaff).mockResolvedValue(sentResult)
  })

  it('sends a privacy-safe push payload for inbound SMS case messages', async () => {
    const result = await notifyClientMessagePushFromConversation('conv_1', {
      id: 'msg_1',
      direction: 'INBOUND',
      channel: 'SMS',
      isSystem: false,
    })

    expect(result).toBe(sentResult)
    expect(sendWebPushToStaff).toHaveBeenCalledWith({
      organizationId: 'org_1',
      staffIds: ['admin_1', 'staff_1'],
      payload: expect.objectContaining({
        title: 'Ella',
        body: 'New client message',
        url: '/messages/case_1',
        tag: 'case-message:case_1',
      }),
    })

    const payload = vi.mocked(sendWebPushToStaff).mock.calls[0][0].payload
    expect(JSON.stringify(payload)).not.toContain('Hello from client')
    expect(JSON.stringify(payload)).not.toContain('Client Name')
    expect(JSON.stringify(payload)).not.toContain('phone')
  })

  it('does not send for outbound, call, or system messages', async () => {
    await notifyClientMessagePushFromConversation('conv_1', {
      id: 'msg_outbound',
      direction: 'OUTBOUND',
      channel: 'SMS',
    })
    await notifyClientMessagePushFromConversation('conv_1', {
      id: 'msg_call',
      direction: 'INBOUND',
      channel: 'CALL',
    })
    await notifyClientMessagePushFromConversation('conv_1', {
      id: 'msg_system',
      direction: 'INBOUND',
      channel: 'SMS',
      isSystem: true,
    })

    expect(resolveClientMessagePushRecipients).not.toHaveBeenCalled()
    expect(sendWebPushToStaff).not.toHaveBeenCalled()
  })

  it('does not throw when recipient resolution fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(resolveClientMessagePushRecipients).mockRejectedValueOnce(new Error('database down'))

    await expect(
      notifyClientMessagePushFromConversation('conv_1', {
        id: 'msg_1',
        direction: 'INBOUND',
        channel: 'PORTAL',
      })
    ).resolves.toBeNull()

    expect(sendWebPushToStaff).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('logs safe aggregate details when automatic delivery is incomplete', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(sendWebPushToStaff).mockResolvedValueOnce({
      configured: true,
      attempted: 1,
      sent: 0,
      failed: 1,
      disabled: 1,
      failures: [{ subscriptionId: 'sub_secret', statusCode: 410 }],
    })

    await notifyClientMessagePushFromConversation('conv_1', {
      id: 'msg_1',
      direction: 'INBOUND',
      channel: 'SMS',
    })

    expect(warnSpy).toHaveBeenCalledWith(
      '[WebPush] Client message delivery incomplete',
      expect.objectContaining({
        conversationId: 'conv_1',
        messageId: 'msg_1',
        attempted: 1,
        sent: 0,
        failed: 1,
        disabled: 1,
        failureStatusCodes: [410],
      })
    )
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('sub_secret')
    warnSpy.mockRestore()
  })
})
