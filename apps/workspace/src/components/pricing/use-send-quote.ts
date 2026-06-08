/**
 * Mutation hook for sending a calculated pricing quote to a Client or Lead.
 * Wraps `POST /billing/quotes/send`; the caller owns toast/result presentation.
 */
import { useMutation } from '@tanstack/react-query'
import { api, type SendQuoteInput, type SendQuoteResponse } from '../../lib/api-client'

export function useSendQuote() {
  return useMutation<SendQuoteResponse, Error, SendQuoteInput>({
    mutationFn: (input) => api.billing.sendQuote(input),
  })
}
