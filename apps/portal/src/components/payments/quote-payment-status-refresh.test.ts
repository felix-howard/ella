import { afterEach, describe, expect, it, vi } from 'vitest'
import { quoteApi, type PublicQuoteView } from '../../lib/quote-api'
import { refreshQuotePaymentStatus } from './quote-payment-status-refresh'

vi.mock('../../lib/quote-api', () => ({
  quoteApi: {
    getQuote: vi.fn(),
    createCheckout: vi.fn(),
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('refreshQuotePaymentStatus', () => {
  it('uses only the quote GET endpoint and never starts checkout', async () => {
    const view = { orgName: 'Ella Tax' } as PublicQuoteView
    vi.mocked(quoteApi.getQuote).mockResolvedValue(view)

    await expect(refreshQuotePaymentStatus('pay_tok_123')).resolves.toBe(view)

    expect(quoteApi.getQuote).toHaveBeenCalledWith('pay_tok_123')
    expect(quoteApi.createCheckout).not.toHaveBeenCalled()
  })
})
