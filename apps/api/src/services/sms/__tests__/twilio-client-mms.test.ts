import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('../../../lib/config', () => ({
  config: {
    twilio: {
      isConfigured: true,
      accountSid: 'AC_test',
      authToken: 'auth_test',
      phoneNumber: '+15550000000',
      webhookBaseUrl: '',
    },
  },
}))

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: {
      create: mocks.create,
    },
  })),
}))

import { sendSms } from '../twilio-client'

describe('twilio MMS send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not retry media sends because provider create is not idempotent', async () => {
    mocks.create.mockRejectedValue(new Error('temporary provider failure https://signed.example.com/image.png'))

    const result = await sendSms({
      to: '+15551234567',
      body: '',
      mediaUrl: ['https://signed.example.com/image.png'],
    })

    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      success: false,
      error: 'temporary provider failure [REDACTED_URL]',
    })
  })
})
