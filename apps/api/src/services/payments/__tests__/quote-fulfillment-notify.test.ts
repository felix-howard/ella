/**
 * Tests for sent-quote first-payment notifications: admin alert fan-out plus
 * client receipt handling.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminNotifyMocks = vi.hoisted(() => ({
  smsOptedInAdmins: vi.fn(),
}))

const signerSmsMocks = vi.hoisted(() => ({
  sendSignerSmsAndPersist: vi.fn(),
}))

vi.mock('../../agreements/agreement-post-sign-notifications', () => adminNotifyMocks)
vi.mock('../signer-sms-delivery', () => signerSmsMocks)

import { notifyFirstQuotePayment } from '../quote-fulfillment-notify'
import type { QuoteSigner, SendableQuote } from '../quote-fulfillment-types'

function quote(overrides: Partial<SendableQuote> = {}): SendableQuote {
  return {
    id: 'quote_1',
    organizationId: 'org_1',
    sentByStaffId: 'staff_1',
    clientId: 'client_1',
    leadId: null,
    client: null,
    lead: null,
    ...overrides,
  } as SendableQuote
}

function signer(overrides: Partial<QuoteSigner> = {}): QuoteSigner {
  return {
    id: 'client_1',
    firstName: 'Tuyet',
    lastName: 'Nguyen',
    phone: '+18136442540',
    kind: 'client',
    ...overrides,
  }
}

describe('notifyFirstQuotePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminNotifyMocks.smsOptedInAdmins.mockResolvedValue([])
    signerSmsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  it('notifies admins and sends a quote receipt to the payer', async () => {
    await notifyFirstQuotePayment({
      quote: quote(),
      signer: signer(),
      amountFormatted: '$899.00',
    })

    expect(adminNotifyMocks.smsOptedInAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        toggle: 'notifyOnClientPayment',
        message: 'Tuyet Nguyen paid $899.00 (quote)',
      }),
    )
    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
      { signerId: 'client_1', signerKind: 'client', organizationId: 'org_1', sentById: 'staff_1' },
      'Hi Tuyet, we received your $899.00 payment. Thank you!',
      'quote_receipt',
    )
  })

  it('still sends the payer receipt when the same phone also got the admin alert', async () => {
    adminNotifyMocks.smsOptedInAdmins.mockResolvedValue(['+18136442540'])

    await notifyFirstQuotePayment({
      quote: quote(),
      signer: signer(),
      amountFormatted: '$899.00',
    })

    expect(signerSmsMocks.sendSignerSmsAndPersist).toHaveBeenCalledWith(
      { signerId: 'client_1', signerKind: 'client', organizationId: 'org_1', sentById: 'staff_1' },
      'Hi Tuyet, we received your $899.00 payment. Thank you!',
      'quote_receipt',
    )
  })
})
