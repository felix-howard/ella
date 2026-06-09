/**
 * Public deposit payment route.
 * URL: /pay/:payToken (?status=success|canceled set by Stripe return URLs)
 * SMS'd to clients after they sign an agreement that collects a deposit.
 */
import { createFileRoute } from '@tanstack/react-router'
import { PaymentPayPage } from '../../../components/payments/payment-pay-page'

interface PayPageSearch {
  status?: 'success' | 'canceled'
}

export const Route = createFileRoute('/pay/$payToken/')({
  validateSearch: (search: Record<string, unknown>): PayPageSearch => ({
    status: search.status === 'success' || search.status === 'canceled' ? search.status : undefined,
  }),
  component: PayTokenRouteComponent,
})

function PayTokenRouteComponent() {
  const { payToken } = Route.useParams()
  const { status } = Route.useSearch()
  return <PaymentPayPage payToken={payToken} returnStatus={status} />
}
