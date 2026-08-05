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

import {
  notifyDuplicateQuotePayment,
  notifyFirstQuotePayment,
  notifyQuotePaymentFailed,
  notifyRecurringQuotePayment,
} from '../quote-fulfillment-notify'
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
      'Hi Tuyet, we received your payment. Thank you!',
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
      'Hi Tuyet, we received your payment. Thank you!',
      'quote_receipt',
    )
  })
})

describe('notifyDuplicateQuotePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminNotifyMocks.smsOptedInAdmins.mockResolvedValue([])
    signerSmsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  it('alerts admins without sending another payer receipt', async () => {
    await notifyDuplicateQuotePayment({
      quote: quote(),
      signer: signer(),
      amountFormatted: '$899.00',
      stripeSessionId: 'cs_dup_123',
      stripePaymentIntentId: 'pi_dup_123',
    })

    expect(adminNotifyMocks.smsOptedInAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        toggle: 'notifyOnClientPayment',
        message:
          'Duplicate payment review: Tuyet Nguyen paid $899.00 again for quote. ' +
          'Review Stripe payment pi_dup_123 before refunding.',
      }),
    )
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })
})

describe('notifyRecurringQuotePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminNotifyMocks.smsOptedInAdmins.mockResolvedValue([])
    signerSmsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  it('notifies payment-alert admins without sending another payer receipt', async () => {
    await notifyRecurringQuotePayment({
      quote: quote(),
      signer: signer(),
      amountFormatted: '$85.00',
    })

    expect(adminNotifyMocks.smsOptedInAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        toggle: 'notifyOnClientPayment',
        message: 'Tuyet Nguyen paid $85.00 (recurring quote)',
      }),
    )
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })
})

describe('notifyQuotePaymentFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminNotifyMocks.smsOptedInAdmins.mockResolvedValue([])
    signerSmsMocks.sendSignerSmsAndPersist.mockResolvedValue({ delivered: true })
  })

  it('uses payment-success or payment-failure admin toggles', async () => {
    await notifyQuotePaymentFailed({
      quote: quote(),
      signer: signer(),
      amountFormatted: '$85.00',
    })

    expect(adminNotifyMocks.smsOptedInAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        toggle: ['notifyOnClientPayment', 'notifyOnPaymentFailed'],
        message: "Payment failed: couldn't collect $85.00 from Tuyet Nguyen. Follow up to update their card.",
      }),
    )
    expect(signerSmsMocks.sendSignerSmsAndPersist).not.toHaveBeenCalled()
  })
})
