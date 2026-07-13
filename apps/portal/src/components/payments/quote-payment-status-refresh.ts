import { quoteApi, type PublicQuoteView } from '../../lib/quote-api'

export async function refreshQuotePaymentStatus(payToken: string): Promise<PublicQuoteView> {
  return quoteApi.getQuote(payToken)
}
