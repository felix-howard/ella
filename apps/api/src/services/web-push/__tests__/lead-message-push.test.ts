import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveLeadMessagePushRecipients: vi.fn(),
  sendWebPushToStaff: vi.fn(),
}))

vi.mock('../recipient-resolver', () => ({
  resolveLeadMessagePushRecipients: mocks.resolveLeadMessagePushRecipients,
}))

vi.mock('../push-delivery-service', () => ({
  sendWebPushToStaff: mocks.sendWebPushToStaff,
}))

import { sendWebPushToStaff } from '../push-delivery-service'
import { notifyLeadMessagePushFromLead } from '../lead-message-push'
import { resolveLeadMessagePushRecipients } from '../recipient-resolver'

const sentResult = {
  configured: true,
  attempted: 1,
  sent: 1,
  failed: 0,
  disabled: 0,
  failures: [],
}

describe('notifyLeadMessagePushFromLead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveLeadMessagePushRecipients).mockResolvedValue({
      leadId: 'lead_1',
      organizationId: 'org_1',
      staffIds: ['admin_1', 'manager_1'],
    })
    vi.mocked(sendWebPushToStaff).mockResolvedValue(sentResult)
  })

  it('sends a privacy-safe push payload for inbound lead SMS replies', async () => {
    const result = await notifyLeadMessagePushFromLead('lead_1', {
      id: 'msg_1',
      direction: 'INBOUND',
      channel: 'SMS',
      isSystem: false,
    })

    expect(result).toBe(sentResult)
    expect(sendWebPushToStaff).toHaveBeenCalledWith({
      organizationId: 'org_1',
      staffIds: ['admin_1', 'manager_1'],
      payload: expect.objectContaining({
        title: 'Ella',
        body: 'New lead reply',
        url: '/leads/lead_1',
        tag: 'lead-message:lead_1',
      }),
    })

    const payload = vi.mocked(sendWebPushToStaff).mock.calls[0][0].payload
    expect(JSON.stringify(payload)).not.toContain('Lead Name')
    expect(JSON.stringify(payload)).not.toContain('+15551234567')
    expect(JSON.stringify(payload)).not.toContain('reply body')
  })

  it('does not send for outbound, call, or system messages', async () => {
    await notifyLeadMessagePushFromLead('lead_1', {
      id: 'msg_outbound',
      direction: 'OUTBOUND',
      channel: 'SMS',
    })
    await notifyLeadMessagePushFromLead('lead_1', {
      id: 'msg_call',
      direction: 'INBOUND',
      channel: 'CALL',
    })
    await notifyLeadMessagePushFromLead('lead_1', {
      id: 'msg_system',
      direction: 'INBOUND',
      channel: 'SMS',
      isSystem: true,
    })

    expect(resolveLeadMessagePushRecipients).not.toHaveBeenCalled()
    expect(sendWebPushToStaff).not.toHaveBeenCalled()
  })

  it('does not throw when recipient resolution fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(resolveLeadMessagePushRecipients).mockRejectedValueOnce(new Error('database down'))

    await expect(
      notifyLeadMessagePushFromLead('lead_1', {
        id: 'msg_1',
        direction: 'INBOUND',
        channel: 'SMS',
      })
    ).resolves.toBeNull()

    expect(sendWebPushToStaff).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
