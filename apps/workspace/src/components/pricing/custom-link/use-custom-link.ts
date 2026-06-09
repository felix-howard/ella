/**
 * Mutation hooks for the custom (free-form) payment-link flows.
 * Wrap `POST /billing/checkout-sessions/custom` and `/billing/quotes/send/custom`;
 * callers own toast/result presentation (mirrors `use-send-quote`).
 */
import { useMutation } from '@tanstack/react-query'
import {
  api,
  type CheckoutSessionResponse,
  type CreateCustomCheckoutInput,
  type SendCustomQuoteInput,
  type SendQuoteResponse,
} from '../../../lib/api-client'

export function useCreateCustomLink() {
  return useMutation<CheckoutSessionResponse, Error, CreateCustomCheckoutInput>({
    mutationFn: (input) => api.billing.createCustomCheckoutSession(input),
  })
}

export function useSendCustomQuote() {
  return useMutation<SendQuoteResponse, Error, SendCustomQuoteInput>({
    mutationFn: (input) => api.billing.sendCustomQuote(input),
  })
}
