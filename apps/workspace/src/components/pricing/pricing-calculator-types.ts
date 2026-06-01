import type { CheckoutSessionResponse } from '../../lib/api-client'

export interface PricingCustomerFields {
  customerEmail: string
  customerName: string
  businessName: string
}

export type PricingCheckout = CheckoutSessionResponse | null
