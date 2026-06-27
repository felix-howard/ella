import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripeMocks = vi.hoisted(() => ({
  invoicesRetrieve: vi.fn(),
  paymentIntentsRetrieve: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class {
    invoices = { retrieve: stripeMocks.invoicesRetrieve }
    paymentIntents = { retrieve: stripeMocks.paymentIntentsRetrieve }
  },
}))

vi.mock('../../../lib/config', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_mock',
      isConfigured: true,
    },
  },
}))

import {
  getReceiptFactsFromInvoice,
  getReceiptFactsFromPaymentIntentId,
} from '../stripe-receipt-facts'

describe('stripe receipt facts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns partial invoice facts when invoice retrieval fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stripeMocks.invoicesRetrieve.mockRejectedValue(new Error('stripe down'))

    await expect(getReceiptFactsFromInvoice('in_123')).resolves.toEqual({
      stripeInvoiceId: 'in_123',
    })
    expect(stripeMocks.invoicesRetrieve).toHaveBeenCalledWith('in_123', {
      expand: ['payments.data.payment.charge', 'payments.data.payment.payment_intent.latest_charge'],
    })
    errorSpy.mockRestore()
  })

  it('returns the PaymentIntent id when PaymentIntent retrieval fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stripeMocks.paymentIntentsRetrieve.mockRejectedValue(new Error('stripe down'))

    await expect(getReceiptFactsFromPaymentIntentId('pi_123')).resolves.toEqual({
      stripePaymentIntentId: 'pi_123',
    })
    expect(stripeMocks.paymentIntentsRetrieve).toHaveBeenCalledWith('pi_123', {
      expand: ['latest_charge'],
    })
    errorSpy.mockRestore()
  })

  it('extracts a PaymentIntent id from the newer invoice payment string shape', async () => {
    const facts = await getReceiptFactsFromInvoice({
      object: 'invoice',
      payments: {
        data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_invoice_123' } }],
      },
    })

    expect(facts).toEqual({ stripePaymentIntentId: 'pi_invoice_123' })
    expect(stripeMocks.invoicesRetrieve).not.toHaveBeenCalled()
  })
})
