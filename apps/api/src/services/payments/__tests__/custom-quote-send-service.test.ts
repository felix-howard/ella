import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SendCustomQuoteInput } from '../../../routes/billing/schemas'

const prismaMocks = vi.hoisted(() => ({
  paymentQuote: {
    create: vi.fn(),
    count: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
}))

const customQuoteMocks = vi.hoisted(() => ({
  buildCustomQuote: vi.fn(),
}))

const smsMocks = vi.hoisted(() => ({
  sendSignerSmsAndPersist: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../lib/constants', () => ({ PORTAL_URL: 'http://portal.test' }))
vi.mock('../../stripe/custom-quote-builder', () => customQuoteMocks)
vi.mock('../signer-sms-delivery', () => smsMocks)

import { createSendableCustomQuote } from '../custom-quote-send-service'

const input: SendCustomQuoteInput = {
  billingInterval: 'one_time',
  items: [{ label: 'Advisory', unitAmountCents: 50000, quantity: 1 }],
  recipient: { type: 'client', id: 'client_1' },
  customerEmail: 'client@example.com',
  customerName: 'John Client',
}

describe('createSendableCustomQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    customQuoteMocks.buildCustomQuote.mockReturnValue({
      quote: {
        quoteId: 'quote_custom_1',
        monthlyItems: [],
        setupItems: [{ label: 'Advisory', amount: 500, kind: 'setup' }],
        monthlyTotal: 0,
        setupTotal: 500,
      },
      lineItems: [],
      billingInterval: 'one_time',
    })
    prismaMocks.organization.findUnique.mockResolvedValue({ name: 'Acme Tax' })
    prismaMocks.client.findFirst.mockResolvedValue({
      id: 'client_1',
      firstName: 'John',
      phone: '+14155551234',
    })
    prismaMocks.paymentQuote.count.mockResolvedValue(0)
    prismaMocks.paymentQuote.create.mockResolvedValue({ id: 'quote_custom_1' })
    smsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  it('blocks sending a custom client quote while another ACH payment is processing', async () => {
    prismaMocks.paymentQuote.count.mockResolvedValueOnce(1)

    await expect(
      createSendableCustomQuote(input, { organizationId: 'org_1', staffId: 'staff_1' }),
    ).rejects.toMatchObject({ status: 409 })

    expect(prismaMocks.paymentQuote.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
      }),
    })
    expect(prismaMocks.paymentQuote.create).not.toHaveBeenCalled()
    expect(smsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })
})
